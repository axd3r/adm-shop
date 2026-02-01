import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Order } from './order.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity({ name: 'order_items' })
export class OrderItem {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Order Item ID',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column('uuid')
  productId: string;

  @ApiProperty({
    example: 'Kids Cyberquad Bomber Jacket',
    description: 'Product title at time of purchase',
  })
  @Column('text')
  productTitle: string;

  @ApiProperty({
    example: 75.0,
    description: 'Product price at time of purchase',
  })
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ApiProperty({
    example: 2,
    description: 'Quantity ordered',
  })
  @Column('int')
  quantity: number;

  @ApiProperty({
    example: 'M',
    description: 'Selected size',
  })
  @Column('text', { nullable: true })
  size: string;

  @ApiProperty({
    example: 150.0,
    description: 'Subtotal for this item (price * quantity)',
  })
  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;
}
