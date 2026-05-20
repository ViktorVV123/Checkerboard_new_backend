// src/import/import.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ImportService } from './import.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { PreviewResponseDto } from './dto/preview-response.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@ApiTags('Импорт Excel')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Превью импорта из шахматки Excel (ничего не пишет)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PreviewResponseDto> {
    if (!file) {
      throw new BadRequestException('Файл не передан (поле "file" пустое)');
    }
    return this.importService.preview(file);
  }

  @Post('commit')
  @ApiOperation({
    summary: 'Создать новый черновик и записать правки из ранее показанного превью',
  })
  async commit(@Body() dto: CommitImportDto, @Req() req: any) {
    const user = req?.user?.User || req?.user;
    const username = user?.username;
    return this.importService.commit(dto, username);
  }
}
