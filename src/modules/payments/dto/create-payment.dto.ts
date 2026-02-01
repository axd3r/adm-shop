import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, PaymentProvider } from '../enums';

class PayerIdentificationDto {
  @ApiProperty({ example: 'DNI', description: 'Document type' })
  @IsString()
  type: string;

  @ApiProperty({ example: '12345678', description: 'Document number' })
  @IsString()
  number: string;
}

export class CreatePaymentDto {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Order ID to pay',
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    example: PaymentProvider.CULQI,
    description: 'Payment gateway provider',
    enum: PaymentProvider,
  })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiProperty({
    example: 'tkn_live_xxxxx',
    description: 'Payment token from frontend SDK',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: PaymentMethod.CREDIT_CARD,
    description: 'Payment method',
    enum: PaymentMethod,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email for receipt',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Compra en ADM Shop',
    description: 'Payment description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  // MercadoPago specific fields
  @ApiProperty({
    example: 1,
    description: 'Number of installments (MercadoPago)',
    required: false,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  installments?: number;

  @ApiProperty({
    example: 'visa',
    description: 'Payment method ID from MercadoPago',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiProperty({
    description: 'Payer identification for MercadoPago',
    required: false,
    type: PayerIdentificationDto,
  })
  @ValidateNested()
  @Type(() => PayerIdentificationDto)
  @IsOptional()
  identification?: PayerIdentificationDto;

  // Stripe specific fields
  @ApiProperty({
    example: 'https://mysite.com/payment/complete',
    description: 'Return URL for 3DS (Stripe)',
    required: false,
  })
  @IsString()
  @IsOptional()
  returnUrl?: string;
}
