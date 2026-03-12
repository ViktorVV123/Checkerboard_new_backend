import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScenarioDto {
  @ApiProperty({ example: 'Сценарий март', description: 'Название сценария' })
  @IsString()
  @IsNotEmpty({ message: 'Название не может быть пустым' })
  name: string;

  @ApiProperty({ example: 'Иванов И.И.', description: 'Автор сценария' })
  @IsString()
  @IsNotEmpty({ message: 'Автор не может быть пустым' })
  author: string;

  @ApiProperty({ example: 'ВНП', description: 'Предприятие' })
  @IsString()
  @IsNotEmpty({ message: 'Предприятие не может быть пустым' })
  enterprise: string;

  @ApiPropertyOptional({ example: 'Тестовый прогноз', description: 'Комментарий' })
  @IsString()
  @IsOptional()
  comment?: string;
}
