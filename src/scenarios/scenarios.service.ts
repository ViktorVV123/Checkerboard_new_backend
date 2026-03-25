// src/scenarios/scenarios.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScenariosService {
  constructor(private prisma: PrismaService) {}

  async getAll(enterprise?: string, username?: string) {
    console.log('[getAll] enterprise:', enterprise, 'username:', username);

    // Временно — проверяем без фильтра
    const all = await this.prisma.scenarios.findMany({
      where: enterprise ? { enterprise } : undefined,
    });
    console.log('[getAll] ALL without filter:', all.length, all.map(r => ({
      id: r.id, name: r.name, isDraft: r.isDraft, createdBy: r.createdBy
    })));

    const result = await this.prisma.scenarios.findMany({
      where: {
        ...(enterprise ? { enterprise } : {}),
        OR: [
          { isDraft: false },
          ...(username ? [{ isDraft: true, createdBy: username }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[getAll] WITH filter:', result.length);
    return result;
  }

  async create(data: {
    name: string;
    author: string;
    enterprise: string;
    comment?: string;
    isDraft?: boolean;
    createdBy?: string;
  }) {
    return this.prisma.scenarios.create({ data });
  }

  async delete(id: number) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${id} не найден`);
    return this.prisma.scenarios.delete({ where: { id } });
  }

  async getEdits(scenarioId: number) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${scenarioId} не найден`);
    return this.prisma.scenario_edits.findMany({ where: { scenarioId } });
  }

  async saveEdit(data: {
    scenarioId: number;
    originalId: number;
    field: string;
    value: string;
  }) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id: data.scenarioId } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${data.scenarioId} не найден`);

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

  async saveSnapshot(
    scenarioId: number,
    product: string,
    rows: { originalId: number; field: string; value: string }[],
  ) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${scenarioId} не найден`);

    const existingEdits = await this.prisma.scenario_edits.findMany({ where: { scenarioId } });
    const newOriginalIds = [...new Set(rows.map((r) => r.originalId))];
    const toDelete = existingEdits
      .filter((e) => newOriginalIds.includes(e.originalId))
      .map((e) => e.id);

    if (toDelete.length > 0) {
      await this.prisma.scenario_edits.deleteMany({ where: { id: { in: toDelete } } });
    }

    await this.prisma.scenario_edits.createMany({
      data: rows.map((edit) => ({ scenarioId, ...edit })),
    });

    return { saved: rows.length };
  }

  async deleteEdit(id: number) {
    const edit = await this.prisma.scenario_edits.findUnique({ where: { id } });
    if (!edit) throw new NotFoundException(`Правка с id ${id} не найдена`);
    return this.prisma.scenario_edits.delete({ where: { id } });
  }

  async getScenarioData(scenarioId: number) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${scenarioId} не найден`);

    const edits = await this.prisma.scenario_edits.findMany({ where: { scenarioId } });

    const rowsMap = new Map<number, Record<string, any>>();
    for (const edit of edits) {
      if (!rowsMap.has(edit.originalId)) {
        rowsMap.set(edit.originalId, { id: edit.originalId });
      }
      rowsMap.get(edit.originalId)![edit.field] = edit.value;
    }

    return Array.from(rowsMap.values());
  }

  async approve(id: number, approvedBy: string) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${id} не найден`);

    await this.prisma.scenarios.updateMany({
      where: { enterprise: scenario.enterprise, approved: true },
      data: { approved: false, approvedAt: null, approvedBy: null },
    });

    return this.prisma.scenarios.update({
      where: { id },
      data: { approved: true, approvedAt: new Date(), approvedBy },
    });
  }

  async publish(id: number, username: string) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${id} не найден`);
    if (scenario.createdBy !== username) {
      throw new ForbiddenException('Можно публиковать только свои черновики');
    }
    return this.prisma.scenarios.update({
      where: { id },
      data: { isDraft: false },
    });
  }

  async unpublish(id: number, username: string) {
    const scenario = await this.prisma.scenarios.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException(`Сценарий с id ${id} не найден`);
    if (scenario.createdBy !== username) {
      throw new ForbiddenException('Можно изменять только свои сценарии');
    }
    return this.prisma.scenarios.update({
      where: { id },
      data: { isDraft: true },
    });
  }
  async deleteEditByParams(scenarioId: number, originalId: number, field: string) {
    await this.prisma.scenario_edits.deleteMany({
      where: { scenarioId, originalId, field },
    });
  }
}
