import { Controller, Get, Post, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { SaveEditDto } from './dto/save-edit.dto';
import { SaveSnapshotDto } from './dto/save-snapshot.dto';

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
  create(@Body() dto: CreateScenarioDto) {
    return this.scenariosService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить сценарий' })
  @ApiParam({ name: 'id', example: 1 })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.delete(id);
  }

  @Get(':id/edits')
  @ApiOperation({ summary: 'Получить правки сценария' })
  @ApiParam({ name: 'id', example: 1 })
  getEdits(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.getEdits(id);
  }

  @Post(':id/edits')
  @ApiOperation({ summary: 'Сохранить правку' })
  @ApiParam({ name: 'id', example: 1 })
  saveEdit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveEditDto,
  ) {
    return this.scenariosService.saveEdit({
      scenarioId: id,
      ...dto,
    });
  }

  @Post(':id/snapshot')
  @ApiOperation({ summary: 'Сохранить полный снапшот продукта' })
  @ApiParam({ name: 'id', example: 1 })
  saveSnapshot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveSnapshotDto,
  ) {
    return this.scenariosService.saveSnapshot(id, dto.product, dto.rows);
  }

  @Get(':id/data')
  @ApiOperation({ summary: 'Получить данные сценария' })
  @ApiParam({ name: 'id', example: 1 })
  getScenarioData(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.getScenarioData(id);
  }

  @Delete('edits/:editId')
  @ApiOperation({ summary: 'Удалить правку' })
  @ApiParam({ name: 'editId', example: 1 })
  deleteEdit(@Param('editId', ParseIntPipe) editId: number) {
    return this.scenariosService.deleteEdit(editId);
  }
}
