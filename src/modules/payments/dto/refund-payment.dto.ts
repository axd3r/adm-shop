import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({
    example: 'Customer requested refund',
    description: 'Reason for refund',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    example: 50.00,
    description: 'Amount to refund (partial refund). If not provided, full refund.',
    required: false,
  })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;
}
