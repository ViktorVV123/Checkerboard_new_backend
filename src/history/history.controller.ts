import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HistoryService } from './history.service';

@ApiTags('История')
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('dates')
  @ApiOperation({ summary: 'Доступные даты снапшотов' })
  getDates() {
    return this.historyService.getAvailableDates();
  }

  @Get('snapshot')
  @ApiOperation({ summary: 'Данные за конкретную дату' })
  @ApiQuery({ name: 'enterprise', required: true, example: 'ВНП' })
  @ApiQuery({ name: 'product', required: true, example: 'Нафта' })
  @ApiQuery({ name: 'date', required: true, example: '2026-03-15' })
  getSnapshot(
    @Query('enterprise') enterprise: string,
    @Query('product') product: string,
    @Query('date') date: string,
  ) {
    return this.historyService.getSnapshot(enterprise, product, date);
  }

  @Get('take')
  @ApiOperation({ summary: 'Принудительно сделать снапшот (для тестирования)' })
  takeSnapshot() {
    return this.historyService.takeSnapshot();
  }
}
