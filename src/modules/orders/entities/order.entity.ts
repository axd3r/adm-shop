import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from '../enums';

@Entity({ name: 'orders' })
export class Order {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Order ID',
    uniqueItems: true,
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'ORD-20260115-001',
    description: 'Order number for display',
  })
  @Column('text', { unique: true })
  orderNumber: string;

  @ApiProperty({
    example: OrderStatus.PENDING,
    description: 'Order status',
    enum: OrderStatus,
  })
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @ApiProperty({
    example: 150.5,
    description: 'Order subtotal (before taxes and discounts)',
  })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @ApiProperty({
    example: 27.09,
    description: 'Tax amount',
  })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax: number;

  @ApiProperty({
    example: 0,
    description: 'Discount amount',
  })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @ApiProperty({
    example: 10,
    description: 'Shipping cost',
  })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shippingCost: number;

  @ApiProperty({
    example: 187.59,
    description: 'Order total',
  })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  @ApiProperty({
    example: 'PEN',
    description: 'Currency code',
  })
  @Column('text', { default: 'PEN' })
  currency: string;

  @ApiProperty({
    example: 'Av. Javier Prado 123, San Isidro, Lima',
    description: 'Shipping address',
  })
  @Column('text', { nullable: true })
  shippingAddress: string;

  @ApiProperty({
    example: 'Same as shipping',
    description: 'Billing address',
  })
  @Column('text', { nullable: true })
  billingAddress: string;

  @ApiProperty({
    example: 'Please leave at the door',
    description: 'Additional notes',
  })
  @Column('text', { nullable: true })
  notes: string;

  @ApiHideProperty()
  @ManyToOne(() => User, (user) => user.orders, { eager: true })
  user: User;

  @Column('uuid')
  userId: string;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];

  @ApiProperty({
    example: '2026-01-15T10:30:00Z',
    description: 'Date when order was paid',
  })
  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @ApiProperty({
    example: '2026-01-16T14:00:00Z',
    description: 'Date when order was shipped',
  })
  @Column({ type: 'timestamp', nullable: true })
  shippedAt: Date;

  @ApiProperty({
    example: '2026-01-18T09:00:00Z',
    description: 'Date when order was delivered',
  })
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
