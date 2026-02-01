import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 2,
    description: 'New quantity',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    example: 'L',
    description: 'New size',
    required: false,
  })
  @IsString()
  @IsOptional()
  size?: string;
}
