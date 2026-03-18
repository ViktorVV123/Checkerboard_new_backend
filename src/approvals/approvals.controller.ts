// src/approvals/approvals.controller.ts
import {
  Controller, Get, Post, Body, Query,
  UnauthorizedException, ForbiddenException, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';

@ApiTags('Согласование')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  // Статусы согласующих на сегодня для завода
  @Get()
  @ApiOperation({ summary: 'Статусы согласующих на сегодня' })
  @ApiQuery({ name: 'enterprise', required: true, example: 'ВНП' })
  getToday(@Query('enterprise') enterprise: string) {
    return this.approvalsService.getTodayApprovals(enterprise);
  }

  // Список согласующих для завода (без статусов)
  @Get('approvers')
  @ApiOperation({ summary: 'Список согласующих для завода' })
  @ApiQuery({ name: 'enterprise', required: true, example: 'ВНП' })
  getApprovers(@Query('enterprise') enterprise: string) {
    return this.approvalsService.getApprovers(enterprise);
  }

  // Проголосовать
  @Post()
  @ApiOperation({ summary: 'Согласовать или отклонить' })
  async vote(@Body() dto: CreateApprovalDto, @Req() req: any) {
    const user = req.user?.User || req.user;
    const username = user?.username;
    const fullName = user?.cn || username;

    if (!username) {
      throw new UnauthorizedException('Не удалось определить пользователя');
    }

    // Проверяем что пользователь является согласующим для этого завода
    if (!this.approvalsService.isApprover(dto.enterprise, username)) {
      throw new ForbiddenException(
        `Вы не являетесь согласующим для завода ${dto.enterprise}`,
      );
    }

    return this.approvalsService.upsertApproval({
      enterprise: dto.enterprise,
      username,
      fullName,
      status: dto.status,
      comment: dto.comment,
    });
  }
}
