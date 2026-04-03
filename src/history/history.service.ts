import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { FactoriesService } from '../factories/factories.service';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    private prisma: PrismaService,
    private factoriesService: FactoriesService,
  ) {}

  // Каждый день в 21:00
  @Cron('30 23 * * *')
  async takeSnapshot() {
    this.logger.log('Taking daily snapshot...');
    const now = new Date();

    try {
      const enterprises = await this.factoriesService.getEnterprises();

      for (const enterprise of enterprises) {
        const products = await this.factoriesService.getProducts(enterprise);

        for (const product of products) {
          const rows = await this.factoriesService.getProductData(enterprise, product);

          const snapshotRows: {
            enterprise: string;
            product: string;
            date: number;
            field: string;
            value: string;
            snapshotAt: Date;
          }[] = [];
          const fields = [
            'expected', 'plan', 'fact', 'tradeRemains', 'freeCapacity',
            'parkVolume', 'railwayShipmentFact', 'pipeShipmentFact',
            'mnppShipmentFact', 'waterShipmentFact', 'shipmentFact',
            'passport', 'unregisteredShipment', 'obr', 'shipmentPlan',
          ];

          for (const row of rows) {
            for (const field of fields) {
              if (row[field] !== null && row[field] !== undefined) {
                snapshotRows.push({
                  enterprise,
                  product,
                  date: Number(row.date),
                  field,
                  value: String(row[field]),
                  snapshotAt: now,
                });
              }
            }
          }

          if (snapshotRows.length > 0) {
            await this.prisma.history_snapshots.createMany({
              data: snapshotRows,
            });
          }
        }
      }

      this.logger.log('Daily snapshot completed');
    } catch (error) {
      this.logger.error(`Snapshot failed: ${error}`);
    }
  }

  // Получить доступные даты снапшотов
  async getAvailableDates(): Promise<string[]> {
    const results = await this.prisma.$queryRaw<{ d: Date }[]>`
      SELECT DISTINCT DATE(snapshot_at) as d
      FROM chess.history_snapshots
      ORDER BY d DESC
    `;

    return results.map((r) => r.d.toISOString().split('T')[0]);
  }

  // Получить данные снапшота за конкретную дату
  async getSnapshot(enterprise: string, product: string, snapshotDate: string) {
    const startOfDay = new Date(`${snapshotDate}T00:00:00`);
    const endOfDay = new Date(`${snapshotDate}T23:59:59`);

    const rows = await this.prisma.history_snapshots.findMany({
      where: {
        enterprise,
        product,
        snapshotAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Группируем по date → объект с полями
    const rowsMap = new Map<number, Record<string, any>>();

    for (const row of rows) {
      if (!rowsMap.has(row.date)) {
        rowsMap.set(row.date, { date: row.date, enterprise, product });
      }
      const obj = rowsMap.get(row.date)!;
      obj[row.field] = Number(row.value) || row.value;
    }

    return Array.from(rowsMap.values()).sort((a, b) => a.date - b.date);
  }
}
