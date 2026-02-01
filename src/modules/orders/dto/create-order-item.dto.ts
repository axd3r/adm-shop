import {
  IsUUID,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Product ID',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity to order',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 75.0,
    description: 'Price per unit',
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 'M',
    description: 'Selected size (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  size?: string;
}
