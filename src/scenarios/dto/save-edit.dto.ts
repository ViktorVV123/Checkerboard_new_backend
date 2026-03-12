import { IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveEditDto {
  @ApiProperty({ example: 542, description: 'ID строки из chess_data_new' })
  @IsNumber()
  originalId: number;

  @ApiProperty({ example: 'expected', description: 'Название поля' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ example: '4500', description: 'Новое значение' })
  @IsString()
  @IsNotEmpty()
  value: string;
}
