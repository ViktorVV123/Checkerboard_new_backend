import { IsString, IsArray, ValidateNested, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class SnapshotEditDto {
  @IsNumber()
  originalId: number;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class SaveSnapshotDto {
  @ApiProperty({ example: 'Нафта', description: 'Продукт' })
  @IsString()
  @IsNotEmpty()
  product: string;

  @ApiProperty({ type: [SnapshotEditDto], description: 'Массив правок' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SnapshotEditDto)
  rows: SnapshotEditDto[];
}
