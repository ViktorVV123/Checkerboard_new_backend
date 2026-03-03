import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ScenariosService } from './scenarios.service';

@ApiTags('Сценарии')
@Controller('scenarios')
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Get()
  @ApiOperation({ summary: 'Список сценариев' })
  @ApiQuery({ name: 'enterprise', required: false, example: 'ВНП' })
  getAll(@Query('enterprise') enterprise?: string) {
    return this.scenariosService.getAll(enterprise);
  }

  @Post()
  @ApiOperation({ summary: 'Создать сценарий' })
  create(@Body() body: { name: string; author: string; enterprise: string; comment?: string }) {
    return this.scenariosService.create(body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить сценарий' })
  @ApiParam({ name: 'id', example: 1 })
  delete(@Param('id') id: string) {
    return this.scenariosService.delete(Number(id));
  }

  @Get(':id/edits')
  @ApiOperation({ summary: 'Получить правки сценария' })
  @ApiParam({ name: 'id', example: 1 })
  getEdits(@Param('id') id: string) {
    return this.scenariosService.getEdits(Number(id));
  }

  @Post(':id/edits')
  @ApiOperation({ summary: 'Сохранить правку' })
  @ApiParam({ name: 'id', example: 1 })
  saveEdit(
    @Param('id') id: string,
    @Body() body: { originalId: number; field: string; value: string },
  ) {
    return this.scenariosService.saveEdit({
      scenarioId: Number(id),
      ...body,
    });
  }

  @Post(':id/snapshot')
  @ApiOperation({ summary: 'Сохранить полный снапшот продукта' })
  @ApiParam({ name: 'id', example: 1 })
  saveSnapshot(
    @Param('id') id: string,
    @Body() body: { product: string; rows: { originalId: number; field: string; value: string }[] },
  ) {
    return this.scenariosService.saveSnapshot(Number(id), body.product, body.rows);
  }

  @Get(':id/data')
  @ApiOperation({ summary: 'Получить данные сценария' })
  @ApiParam({ name: 'id', example: 1 })
  getScenarioData(@Param('id') id: string) {
    return this.scenariosService.getScenarioData(Number(id));
  }

  @Delete('edits/:editId')
  @ApiOperation({ summary: 'Удалить правку' })
  @ApiParam({ name: 'editId', example: 1 })
  deleteEdit(@Param('editId') editId: string) {
    return this.scenariosService.deleteEdit(Number(editId));
  }
}
