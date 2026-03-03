import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FactoriesService {
  constructor(private prisma: PrismaService) {}

  // Маппинг названий продуктов по заводам
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

  // Скрытые продукты по заводам
  private hiddenProducts: Record<string, string[]> = {
    'ВНП': ['ТБЛ'],
    'ННОС': ['ТБЛ', 'ТБЛ (DMA)'],
    'ПНОС': ['ТБЛ', 'ТБЛ (DMA)'],
  };

  // Порядок продуктов по заводам
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

    // Убираем скрытые продукты
    const hidden = this.hiddenProducts[enterprise] || [];
    const visible = products.filter((p) => !hidden.includes(p));

    // Заменяем все "ДТ кл.X" на один "ДТ кл."
    const hasDtKl = visible.some((p) => p.startsWith('ДТ кл.'));
    const filtered = visible.filter((p) => !p.startsWith('ДТ кл.'));
    if (hasDtKl) {
      filtered.push('ДТ кл.');
    }

    // Применяем переименование
    const renamed = filtered.map((p) => this.renameProduct(enterprise, p));

    // Сортируем по заданному порядку
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

    const lastDayCurr = new Date(year, month, 0).getDate();
    const dateTo = year * 10000 + month * 100 + lastDayCurr;

    return { dateFrom, dateTo };
  }

  async getProductData(enterprise: string, product: string) {
    const { dateFrom, dateTo } = this.getDateRange();

    // Переводим отображаемое имя обратно в оригинальное
    const originalName = this.originalProductName(enterprise, product);

    if (originalName === 'ДТ кл.') {
      return this.getDtKlAggregated(enterprise, dateFrom, dateTo);
    }

    return this.prisma.chess_data_new.findMany({
      where: {
        enterprise,
        product: originalName,
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: 'asc' },
    });
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

    const grouped = new Map<number, any>();

    for (const row of rows) {
      if (!grouped.has(row.date)) {
        grouped.set(row.date, {
          ...row,
          product: 'ДТ кл.',
        });
      } else {
        const existing = grouped.get(row.date);
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

        for (const field of numericFields) {
          if (row[field] !== null && row[field] !== undefined) {
            existing[field] = (existing[field] || 0) + Number(row[field]);
          }
        }

        for (const field of decimalFields) {
          if (row[field] !== null && row[field] !== undefined) {
            const val = Number(existing[field] || 0) + Number(row[field]);
            existing[field] = val;
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
}
