// src/import/dto/preview-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PreviewUnrecognizedDto {
  @ApiProperty()
  col!: number;
  @ApiProperty({ nullable: true })
  productLabel!: string | null;
  @ApiProperty({ nullable: true })
  metricLabel!: string | null;
  @ApiProperty({ enum: ['no_code', 'unknown_product_id', 'unknown_prefix', 'ignored_prefix'] })
  reason!: string;
  @ApiProperty({ required: false })
  raw?: string;
}

export class PreviewEditDto {
  @ApiProperty() date!: number;
  @ApiProperty() enterprise!: string;
  @ApiProperty() product!: string;
  @ApiProperty() field!: string;
  @ApiProperty() value!: number;
}

export class PreviewParkVolumeDto {
  @ApiProperty() enterprise!: string;
  @ApiProperty() product!: string;
  @ApiProperty() value!: number;
}

export class PreviewSummaryDto {
  @ApiProperty() recognizedCols!: number;
  @ApiProperty() unrecognizedCols!: number;
  @ApiProperty({ type: [String] })
  matchedProducts!: string[];
  @ApiProperty() editsCount!: number;
  @ApiProperty() parkVolumesCount!: number;
  @ApiProperty() dataRowsCount!: number;
  @ApiProperty({ type: 'object', properties: { from: { type: 'number' }, to: { type: 'number' } } })
  dateRange!: { from: number; to: number };
}

export class PreviewResponseDto {
  @ApiProperty()
  summary!: PreviewSummaryDto;

  @ApiProperty({ type: [PreviewEditDto] })
  edits!: PreviewEditDto[];

  @ApiProperty({ type: [PreviewParkVolumeDto] })
  parkVolumes!: PreviewParkVolumeDto[];

  @ApiProperty({ type: [PreviewUnrecognizedDto] })
  unrecognized!: PreviewUnrecognizedDto[];
}
