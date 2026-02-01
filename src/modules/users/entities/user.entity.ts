import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Product } from 'src/modules/products/entities/product.entity';
import { Order } from 'src/modules/orders/entities/order.entity';
import { Cart } from 'src/modules/cart/entities/cart.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @ApiProperty({
    description: 'Unique identifier of the user',
    example: 'b3f2e0b2-12ec-4a45-bd73-2c02b1d1a3df',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
    uniqueItems: true,
  })
  @Column('text', {
    unique: true,
  })
  email: string;

  @Column('text', {
    select: false,
  })
  @Exclude()
  password: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @Column('text')
  fullName: string;

  @Column('bool', {
    default: true,
  })
  @Exclude()
  isActive: boolean;

  @ApiProperty({
    description: 'Roles assigned to the user',
    example: ['user', 'admin', 'superUser', 'seller'],
    isArray: true,
  })
  @Column('text', {
    array: true,
    default: ['user'],
  })
  roles: string[];

  @ApiHideProperty()
  @OneToMany(() => Product, (product) => product.user)
  product: Product;

  @ApiHideProperty()
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @ApiHideProperty()
  @OneToOne(() => Cart, (cart) => cart.user)
  cart: Cart;

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.checkFieldsBeforeInsert();
  }
}
