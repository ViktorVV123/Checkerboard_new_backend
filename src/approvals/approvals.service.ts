// src/approvals/approvals.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { APPROVERS_BY_ENTERPRISE, Approver } from './approvals.config';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  // Получить текущую дату как число YYYYMMDD
  private getTodayInt(): number {
    const now = new Date();
    return (
      now.getFullYear() * 10000 +
      (now.getMonth() + 1) * 100 +
      now.getDate()
    );
  }

  // Список согласующих для завода
  getApprovers(enterprise: string): Approver[] {
    return APPROVERS_BY_ENTERPRISE[enterprise] || [];
  }

  // Статусы согласующих на сегодня для завода
  async getTodayApprovals(enterprise: string) {
    const date = this.getTodayInt();
    const approvers = this.getApprovers(enterprise);

    // Получаем все голоса за сегодня по этому заводу
    const votes = await this.prisma.approvals.findMany({
      where: { date, enterprise },
    });

    const votesMap = new Map(votes.map((v) => [v.username, v]));

    // Мёрджим с полным списком согласующих — у кого нет голоса, статус null
    return approvers.map((approver) => {
      const vote = votesMap.get(approver.username);
      return {
        username: approver.username,
        fullName: vote?.fullName || approver.fullName,
        status: vote?.status || null,
        comment: vote?.comment || null,
        updatedAt: vote?.updatedAt || null,
      };
    });
  }

  // Проголосовать / переголосовать (upsert)
  async upsertApproval(data: {
    enterprise: string;
    username: string;
    fullName: string;
    status: 'approved' | 'rejected';
    comment?: string;
  }) {
    const date = this.getTodayInt();

    return this.prisma.approvals.upsert({
      where: {
        date_enterprise_username: {
          date,
          enterprise: data.enterprise,
          username: data.username,
        },
      },
      update: {
        status: data.status,
        comment: data.comment || null,
        fullName: data.fullName,
      },
      create: {
        date,
        enterprise: data.enterprise,
        username: data.username,
        fullName: data.fullName,
        status: data.status,
        comment: data.comment || null,
      },
    });
  }

  // Проверить — является ли пользователь согласующим для завода
  isApprover(enterprise: string, username: string): boolean {
    const approvers = this.getApprovers(enterprise);
    return approvers.some((a) => a.username === username);
  }
}
