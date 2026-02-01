import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/entities/user.entity';
import { Order } from 'src/modules/orders/entities/order.entity';
import { PaymentStatus, PaymentProvider, PaymentMethod } from '../enums';

@Entity({ name: 'payments' })
export class Payment {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Payment ID',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'PAY-20260115-0001',
    description: 'Payment reference number',
  })
  @Column('text', { unique: true })
  referenceNumber: string;

  @ApiHideProperty()
  @ManyToOne(() => User, { eager: true })
  user: User;

  @Column('uuid')
  userId: string;

  @ApiHideProperty()
  @ManyToOne(() => Order, { eager: true })
  order: Order;

  @Column('uuid')
  orderId: string;

  @ApiProperty({
    example: PaymentStatus.PENDING,
    description: 'Payment status',
    enum: PaymentStatus,
  })
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    example: PaymentProvider.CULQI,
    description: 'Payment provider',
    enum: PaymentProvider,
  })
  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  provider: PaymentProvider;

  @ApiProperty({
    example: PaymentMethod.CREDIT_CARD,
    description: 'Payment method',
    enum: PaymentMethod,
  })
  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @ApiProperty({
    example: 187.59,
    description: 'Payment amount',
  })
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({
    example: 'PEN',
    description: 'Currency code',
  })
  @Column('text', { default: 'PEN' })
  currency: string;

  @ApiProperty({
    example: 'chr_live_xxxxx',
    description: 'External provider charge/transaction ID',
  })
  @Column('text', { nullable: true })
  externalId: string;

  @ApiProperty({
    example: '************4242',
    description: 'Masked card number',
  })
  @Column('text', { nullable: true })
  cardMask: string;

  @ApiProperty({
    example: 'VISA',
    description: 'Card brand',
  })
  @Column('text', { nullable: true })
  cardBrand: string;

  @ApiProperty({
    description: 'Raw response from payment provider',
  })
  @Column('jsonb', { nullable: true })
  providerResponse: Record<string, any>;

  @ApiProperty({
    example: 'Insufficient funds',
    description: 'Error message if payment failed',
  })
  @Column('text', { nullable: true })
  errorMessage: string;

  @ApiProperty({
    example: '2026-01-15T10:30:00Z',
    description: 'Date when payment was completed',
  })
  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @ApiProperty({
    example: '2026-01-16T10:30:00Z',
    description: 'Date when payment was refunded',
  })
  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
