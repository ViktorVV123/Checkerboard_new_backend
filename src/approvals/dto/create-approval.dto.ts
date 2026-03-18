// src/approvals/dto/create-approval.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApprovalDto {
  @ApiProperty({ example: 'ВНП' })
  @IsString()
  @IsNotEmpty()
  enterprise: string;

  @ApiProperty({ example: 'approved', enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @ApiPropertyOptional({ example: 'Данные не сошлись' })
  @IsString()
  @IsOptional()
  comment?: string;
}
