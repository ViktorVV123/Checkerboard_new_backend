// src/scenarios/dto/create-scenario.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScenarioDto {
  @ApiProperty({ example: 'Сценарий март' })
  @IsString()
  @IsNotEmpty({ message: 'Название не может быть пустым' })
  name: string;

  @ApiProperty({ example: 'Иванов И.И.' })
  @IsString()
  @IsNotEmpty({ message: 'Автор не может быть пустым' })
  author: string;

  @ApiProperty({ example: 'ВНП' })
  @IsString()
  @IsNotEmpty({ message: 'Предприятие не может быть пустым' })
  enterprise: string;

  @ApiPropertyOptional({ example: 'Тестовый прогноз' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ example: true, description: 'Черновик — виден только автору' })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @ApiPropertyOptional({ example: 'vlasyukviv' })
  @IsString()
  @IsOptional()
  createdBy?: string;
}
