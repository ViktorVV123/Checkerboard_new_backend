// src/import/dto/commit-import.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { IMPORT_SUPPORTED_ENTERPRISES } from '../../shared/excel-schema';

export class ImportEditDto {
  @ApiProperty({ example: 20260401 })
  @IsInt()
  date!: number;

  @ApiProperty({ example: 'ВНП' })
  @IsString()
  enterprise!: string;

  @ApiProperty({ example: 'Мазут' })
  @IsString()
  product!: string;

  @ApiProperty({ example: 'railwayShipmentFact' })
  @IsString()
  field!: string;

  @ApiProperty({ example: 2408 })
  @IsNumber()
  value!: number;
}

export class ImportParkVolumeDto {
  @ApiProperty({ example: 'ВНП' })
  @IsString()
  enterprise!: string;

  @ApiProperty({ example: 'Мазут' })
  @IsString()
  product!: string;

  @ApiProperty({ example: 22276 })
  @IsNumber()
  value!: number;
}

export class CommitImportDto {
  @ApiProperty({ example: 'Импорт АПР-МАЙ', minLength: 1, maxLength: 255 })
  @IsString()
  @Length(1, 255)
  scenarioName!: string;

  @ApiProperty({ enum: IMPORT_SUPPORTED_ENTERPRISES, example: 'ВНП' })
  @IsIn(IMPORT_SUPPORTED_ENTERPRISES as unknown as string[])
  enterprise!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ type: [ImportEditDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEditDto)
  edits!: ImportEditDto[];

  @ApiProperty({ type: [ImportParkVolumeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportParkVolumeDto)
  parkVolumes!: ImportParkVolumeDto[];
}
