import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @ApiProperty({
    type: [CreateOrderItemDto],
    description: 'Order items',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must have at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    example: 'Av. Javier Prado 123, San Isidro, Lima',
    description: 'Shipping address',
  })
  @IsString()
  shippingAddress: string;

  @ApiProperty({
    example: 'Same as shipping',
    description: 'Billing address (optional, defaults to shipping)',
    required: false,
  })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiProperty({
    example: 'Please leave at the door',
    description: 'Additional notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
