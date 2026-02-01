import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Product ID to add',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    example: 1,
    description: 'Quantity to add',
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;

  @ApiProperty({
    example: 'M',
    description: 'Selected size',
    required: false,
  })
  @IsString()
  @IsOptional()
  size?: string;
}
