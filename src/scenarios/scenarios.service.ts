import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScenariosService {
  constructor(private prisma: PrismaService) {}

  async getAll(enterprise?: string) {
    return this.prisma.scenarios.findMany({
      where: enterprise ? { enterprise } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { name: string; author: string; enterprise: string; comment?: string }) {
    return this.prisma.scenarios.create({ data });
  }

  async delete(id: number) {
    return this.prisma.scenarios.delete({ where: { id } });
  }

  async getEdits(scenarioId: number) {
    return this.prisma.scenario_edits.findMany({
      where: { scenarioId },
    });
  }

  async saveEdit(data: {
    scenarioId: number;
    originalId: number;
    field: string;
    value: string;
  }) {
    const existing = await this.prisma.scenario_edits.findFirst({
      where: {
        scenarioId: data.scenarioId,
        originalId: data.originalId,
        field: data.field,
      },
    });

    if (existing) {
      return this.prisma.scenario_edits.update({
        where: { id: existing.id },
        data: { value: data.value },
      });
    }

    return this.prisma.scenario_edits.create({ data });
  }

  // Сохранить ВСЕ данные продукта в сценарий
  async saveSnapshot(
    scenarioId: number,
    product: string,
    rows: { originalId: number; field: string; value: string }[],
  ) {
    // Удаляем старые данные этого продукта в сценарии
    const existingEdits = await this.prisma.scenario_edits.findMany({
      where: { scenarioId },
    });

    // Фильтруем по originalId из новых данных
    const newOriginalIds = [...new Set(rows.map((r) => r.originalId))];
    const toDelete = existingEdits
      .filter((e) => newOriginalIds.includes(e.originalId))
      .map((e) => e.id);

    if (toDelete.length > 0) {
      await this.prisma.scenario_edits.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Создаём новые
    await this.prisma.scenario_edits.createMany({
      data: rows.map((edit) => ({
        scenarioId,
        ...edit,
      })),
    });

    return { saved: rows.length };
  }

  async deleteEdit(id: number) {
    return this.prisma.scenario_edits.delete({ where: { id } });
  }

  // Восстановить данные сценария
  async getScenarioData(scenarioId: number) {
    const edits = await this.prisma.scenario_edits.findMany({
      where: { scenarioId },
    });

    // Группируем по originalId — собираем строку
    const rowsMap = new Map<number, Record<string, any>>();
    for (const edit of edits) {
      if (!rowsMap.has(edit.originalId)) {
        rowsMap.set(edit.originalId, { id: edit.originalId });
      }
      const row = rowsMap.get(edit.originalId)!;
      row[edit.field] = edit.value;
    }

    return Array.from(rowsMap.values());
  }
}
