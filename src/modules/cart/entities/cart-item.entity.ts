import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Cart } from './cart.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity({ name: 'cart_items' })
export class CartItem {
  @ApiProperty({
    example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
    description: 'Cart Item ID',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  cart: Cart;

  @Column('uuid')
  cartId: string;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column('uuid')
  productId: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity of product',
  })
  @Column('int', { default: 1 })
  quantity: number;

  @ApiProperty({
    example: 'M',
    description: 'Selected size',
  })
  @Column('text', { nullable: true })
  size: string;

  @ApiProperty({
    example: 75.0,
    description: 'Price at time of adding to cart',
  })
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ApiProperty({
    example: 150.0,
    description: 'Subtotal (price * quantity)',
  })
  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
