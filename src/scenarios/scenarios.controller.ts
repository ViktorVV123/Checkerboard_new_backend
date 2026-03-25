// src/scenarios/scenarios.controller.ts
import {
  Controller, Get, Post, Delete, Body, Param,
  Query, ParseIntPipe, Req,
} from '@nestjs/common';
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
  @ApiQuery({ name: 'enterprise', required: false })
  getAll(
    @Query('enterprise') enterprise?: string,
    @Req() req?: any,
  ) {
    const user = req?.user?.User || req?.user;
    const username = user?.username;
    return this.scenariosService.getAll(enterprise, username);
  }

  @Post()
  @ApiOperation({ summary: 'Создать сценарий или черновик' })
  create(@Body() dto: CreateScenarioDto, @Req() req: any) {
    const user = req?.user?.User || req?.user;
    const username = user?.username || dto.createdBy;
    return this.scenariosService.create({ ...dto, createdBy: username });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить сценарий' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.delete(id);
  }

  @Get(':id/edits')
  @ApiOperation({ summary: 'Получить правки сценария' })
  getEdits(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.getEdits(id);
  }

  @Post(':id/edits')
  @ApiOperation({ summary: 'Сохранить правку' })
  saveEdit(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveEditDto) {
    return this.scenariosService.saveEdit({ scenarioId: id, ...dto });
  }

  @Post(':id/snapshot')
  @ApiOperation({ summary: 'Сохранить полный снапшот продукта' })
  saveSnapshot(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveSnapshotDto) {
    return this.scenariosService.saveSnapshot(id, dto.product, dto.rows);
  }

  @Get(':id/data')
  @ApiOperation({ summary: 'Получить данные сценария' })
  getScenarioData(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.getScenarioData(id);
  }

  @Delete('edits/:editId')
  @ApiOperation({ summary: 'Удалить правку' })
  deleteEdit(@Param('editId', ParseIntPipe) editId: number) {
    return this.scenariosService.deleteEdit(editId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Утвердить сценарий' })
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { approvedBy: string }) {
    return this.scenariosService.approve(id, body.approvedBy);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Опубликовать черновик' })
  publish(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const user = req?.user?.User || req?.user;
    const username = user?.username;
    return this.scenariosService.publish(id, username);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Вернуть сценарий в черновик' })
  unpublish(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const user = req?.user?.User || req?.user;
    const username = user?.username;
    return this.scenariosService.unpublish(id, username);
  }
  @Delete(':id/edits/:originalId/:field')
  deleteEditByParams(
    @Param('id', ParseIntPipe) id: number,
    @Param('originalId', ParseIntPipe) originalId: number,
    @Param('field') field: string,
  ) {
    return this.scenariosService.deleteEditByParams(id, originalId, field);
  }
}
