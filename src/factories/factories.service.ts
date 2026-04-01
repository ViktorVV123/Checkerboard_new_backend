import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FactoriesService {
  constructor(private prisma: PrismaService) {}

  private productNameMap: Record<string, Record<string, string>> = {
    'ВНП': {
      'Авиакеросины': 'ТС-1',
      'Компонент RMG': 'Кост',
    },
    'ННОС': {
      'Авиакеросины': 'ТС-1',
      'ВГО': 'ВГЛ',
    },
    'ПНОС': {
      'Авиакеросины': 'Керосин',
    },
  };

  private hiddenProducts: Record<string, string[]> = {
    'ВНП': ['ТБЛ'],
    'ННОС': ['ТБЛ', 'ТБЛ (DMA)'],
    'ПНОС': ['ТБЛ', 'ТБЛ (DMA)'],
  };

  /** Какие продукты из БД суммируются в "ФДТ" для каждого завода */
  private fdtComponents: Record<string, string[]> = {
    'ВНП': ['ФДТ', 'ТБЛ'],
    'ННОС': ['ФДТ', 'ТБЛ', 'ТБЛ (DMA)'],
    'ПНОС': ['ФДТ', 'ТБЛ', 'ТБЛ (DMA)'],
  };

  private productOrder: Record<string, string[]> = {
    'ВНП': [
      'Нафта', 'АИ-92', 'АИ-95', 'ТС-1', 'ДТ сорт', 'ДТ кл.',
      'ФДТ', 'ТБЛ (DMA)', 'ВГО', 'Кост', 'Мазут', 'Кокс', 'СУГ',
    ],
    'ННОС': [
      'Нефть', 'ВГЛ', 'АИ-92', 'АИ-95', 'АИ-100', 'ТС-1',
      'ДТ сорт', 'ДТ кл.', 'ФДТ', 'Мазут',
    ],
    'ПНОС': [
      'Нафта', 'СУГ', 'АИ-92', 'АИ-95', 'АИ-100', 'ДТ сорт',
      'ДТ кл.', 'Керосин', 'ВГО', 'ТСЭ', 'Мазут', 'ФДТ', 'Кокс', 'Серная кислота',
    ],
  };

  private renameProduct(enterprise: string, product: string): string {
    return this.productNameMap[enterprise]?.[product] || product;
  }

  private originalProductName(enterprise: string, displayName: string): string {
    const map = this.productNameMap[enterprise];
    if (!map) return displayName;
    const entry = Object.entries(map).find(([, v]) => v === displayName);
    return entry ? entry[0] : displayName;
  }

  async getEnterprises() {
    const result = await this.prisma.chess_data_new.findMany({
      select: { enterprise: true },
      distinct: ['enterprise'],
    });
    return result.map((r) => r.enterprise);
  }

  async getProducts(enterprise: string) {
    const result = await this.prisma.chess_data_new.findMany({
      where: { enterprise },
      select: { product: true },
      distinct: ['product'],
    });

    const products = result.map((r) => r.product);

    const hidden = this.hiddenProducts[enterprise] || [];
    const visible = products.filter((p) => !hidden.includes(p));

    const hasDtKl = visible.some((p) => p.startsWith('ДТ кл.'));
    const filtered = visible.filter((p) => !p.startsWith('ДТ кл.'));
    if (hasDtKl) {
      filtered.push('ДТ кл.');
    }

    const renamed = filtered.map((p) => this.renameProduct(enterprise, p));

    const order = this.productOrder[enterprise] || [];
    return renamed.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });
  }

  private getDateRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDayPrev = new Date(year, month - 1, 0).getDate();
    const dateFrom = prevYear * 10000 + prevMonth * 100 + lastDayPrev;

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const dateTo = nextYear * 10000 + nextMonth * 100 + 15;

    return { dateFrom, dateTo };
  }

  private fillMissingDays(
    rows: any[],
    enterprise: string,
    product: string,
  ): any[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const lastDayCurr = new Date(year, month, 0).getDate();
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    let productHash = 0;
    for (let i = 0; i < product.length; i++) {
      productHash = ((productHash << 5) - productHash + product.charCodeAt(i)) | 0;
    }
    productHash = Math.abs(productHash) % 100;

    const allDates: number[] = [];
    for (let d = 1; d <= lastDayCurr; d++) {
      allDates.push(year * 10000 + month * 100 + d);
    }
    for (let d = 1; d <= 15; d++) {
      allDates.push(nextYear * 10000 + nextMonth * 100 + d);
    }

    const existingDates = new Set(rows.map((r) => r.date));
    const result = [...rows];

    for (const date of allDates) {
      if (!existingDates.has(date)) {
        result.push({
          id: -(date * 100 + productHash),
          date,
          enterprise,
          product,
          plan: null, fact: null, expected: null,
          tradeRemains: null, freeCapacity: null, parkVolume: null,
          shipmentFact: null, railwayShipmentFact: null, pipeShipmentFact: null,
          mnppShipmentFact: null, waterShipmentFact: null, shipmentPlan: null,
          passport: null, passportForecast: null, unregisteredShipment: null,
          pourShipment: null, obr: null,
          railwayPlan: null, pipePlan: null, mnppPlan: null, waterPlan: null,
          railwayObr: null, pipeObr: null, mnppObr: null, waterObr: null,
        });
      }
    }

    return result.sort((a, b) => a.date - b.date);
  }

  async getProductData(enterprise: string, product: string) {
    const { dateFrom, dateTo } = this.getDateRange();

    const originalName = this.originalProductName(enterprise, product);

    let rows: any[];

    if (originalName === 'ДТ кл.') {
      rows = await this.getDtKlAggregated(enterprise, dateFrom, dateTo);
    } else if (originalName === 'ФДТ' && this.fdtComponents[enterprise]) {
      rows = await this.getFdtAggregated(enterprise, dateFrom, dateTo);
    } else {
      rows = await this.prisma.chess_data_new.findMany({
        where: {
          enterprise,
          product: originalName,
          date: { gte: dateFrom, lte: dateTo },
        },
        orderBy: { date: 'asc' },
      });
    }

    return this.fillMissingDays(rows, enterprise, originalName);
  }

  /**
   * Агрегирует ФДТ из нескольких продуктов в зависимости от завода.
   * ВНП: ФДТ + ТБЛ
   * ННОС: ФДТ + ТБЛ + ТБЛ (DMA)
   * ПНОС: ФДТ + ТБЛ + ТБЛ (DMA)
   */
  private async getFdtAggregated(
    enterprise: string,
    dateFrom: number,
    dateTo: number,
  ) {
    const components = this.fdtComponents[enterprise];
    if (!components || components.length === 0) {
      return this.prisma.chess_data_new.findMany({
        where: { enterprise, product: 'ФДТ', date: { gte: dateFrom, lte: dateTo } },
        orderBy: { date: 'asc' },
      });
    }

    const rows = await this.prisma.chess_data_new.findMany({
      where: {
        enterprise,
        product: { in: components },
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: 'asc' },
    });

    return this.aggregateByDate(rows, 'ФДТ');
  }

  private async getDtKlAggregated(
    enterprise: string,
    dateFrom: number,
    dateTo: number,
  ) {
    const rows = await this.prisma.chess_data_new.findMany({
      where: {
        enterprise,
        product: { startsWith: 'ДТ кл.' },
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: 'asc' },
    });

    return this.aggregateByDate(rows, 'ДТ кл.');
  }

  /**
   * Общий метод агрегации строк по дате.
   * Суммирует числовые поля для строк с одинаковой датой.
   */
  private aggregateByDate(rows: any[], productName: string): any[] {
    const grouped = new Map<number, any>();

    const numericFields = [
      'plan', 'fact', 'expected', 'tradeRemains', 'freeCapacity',
      'parkVolume', 'tradeRemains2', 'parkVolumeForForecast',
    ];
    const decimalFields = [
      'railwayShipment', 'waterShipment', 'pipe', 'mnpp',
      'autoShipment', 'shipmentPlan', 'shipmentFact',
      'waterShipmentFact', 'railwayShipmentFact', 'autoShipmentFact',
      'pipeShipmentFact', 'mnppShipmentFact', 'passport',
      'passportForecast', 'shipment', 'shipmentForForecast',
      'expectedForForecast', 'obr',
    ];
    const bigintFields = ['pourShipment', 'unregisteredShipment'];

    for (const row of rows) {
      if (!grouped.has(row.date)) {
        grouped.set(row.date, {
          ...row,
          product: productName,
        });
      } else {
        const existing = grouped.get(row.date);

        for (const field of numericFields) {
          if (row[field] !== null && row[field] !== undefined) {
            existing[field] = (existing[field] || 0) + Number(row[field]);
          }
        }

        for (const field of decimalFields) {
          if (row[field] !== null && row[field] !== undefined) {
            existing[field] = Number(existing[field] || 0) + Number(row[field]);
          }
        }

        for (const field of bigintFields) {
          if (row[field] !== null && row[field] !== undefined) {
            existing[field] = Number(existing[field] || 0) + Number(row[field]);
          }
        }
      }
    }

    return Array.from(grouped.values());
  }

  async getUpdateInfo(enterprise: string) {
    const rows: any[] = await this.prisma.$queryRaw`
        SELECT "Тип данных" as "dataType", "inserted_at" as "insertedAt"
        FROM chess.update_info
        WHERE "Предприятие" = ${enterprise}
        ORDER BY "inserted_at" DESC
    `;

    const result: Record<string, Record<string, string>> = {};

    for (const row of rows) {
      const type = row.dataType as string;
      const date = row.insertedAt;

      if (!type || !date) continue;

      const formatted = new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (type === 'Данные обновлены') {
        result['Обновлено'] = { '': formatted };
        continue;
      }

      const parts = type.split(' ');
      if (parts.length < 2) continue;

      const category = parts[0];
      const rawSub = parts.slice(1).join(' ');

      let sub = rawSub;
      if (rawSub.includes('производств')) sub = 'Произ-во';
      else if (rawSub.includes('отгрузк')) sub = 'Отгрузка';
      else if (rawSub.includes('остатк')) sub = 'Остатки';

      if (!result[category]) result[category] = {};
      result[category][sub] = formatted;
    }

    return result;
  }
}
