import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product', 'items.product.images'],
    });

    if (!cart) {
      cart = this.cartRepository.create({
        userId,
        subtotal: 0,
        itemCount: 0,
      });
      await this.cartRepository.save(cart);
      cart.items = [];
    }

    return cart;
  }

  async addItem(userId: string, addToCartDto: AddToCartDto): Promise<Cart> {
    const { productId, quantity = 1, size } = addToCartDto;

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}`,
      );
    }

    const cart = await this.getCart(userId);

    // Check if item already exists in cart
    let cartItem = await this.cartItemRepository.findOne({
      where: { cartId: cart.id, productId, size },
    });

    if (cartItem) {
      // Update existing item
      cartItem.quantity += quantity;
      cartItem.subtotal = cartItem.price * cartItem.quantity;
      await this.cartItemRepository.save(cartItem);
    } else {
      // Create new item
      cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
        size,
        price: product.price,
        subtotal: product.price * quantity,
      });
      await this.cartItemRepository.save(cartItem);
    }

    await this.updateCartTotals(cart.id);

    this.logger.log(
      `Added ${quantity}x product ${productId} to cart ${cart.id}`,
    );

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    const { quantity, size } = updateCartItemDto;

    if (quantity !== undefined) {
      if (cartItem.product.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${cartItem.product.stock}`,
        );
      }
      cartItem.quantity = quantity;
      cartItem.subtotal = cartItem.price * quantity;
    }

    if (size !== undefined) {
      cartItem.size = size;
    }

    await this.cartItemRepository.save(cartItem);
    await this.updateCartTotals(cart.id);

    this.logger.log(`Updated cart item ${itemId}`);

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<Cart> {
    const cart = await this.getCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    await this.cartItemRepository.remove(cartItem);
    await this.updateCartTotals(cart.id);

    this.logger.log(`Removed item ${itemId} from cart ${cart.id}`);

    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<Cart> {
    const cart = await this.getCart(userId);

    await this.cartItemRepository.delete({ cartId: cart.id });

    cart.subtotal = 0;
    cart.itemCount = 0;
    await this.cartRepository.save(cart);

    this.logger.log(`Cleared cart ${cart.id}`);

    return this.getCart(userId);
  }

  private async updateCartTotals(cartId: string): Promise<void> {
    const items = await this.cartItemRepository.find({
      where: { cartId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    await this.cartRepository.update(cartId, { subtotal, itemCount });
  }

  async getCartForCheckout(userId: string): Promise<{
    items: CartItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    total: number;
  }> {
    const cart = await this.getCart(userId);

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const subtotal = Number(cart.subtotal);
    const tax = subtotal * 0.18; // 18% IGV Peru
    const shippingCost = subtotal >= 100 ? 0 : 10;
    const total = subtotal + tax + shippingCost;

    return {
      items: cart.items,
      subtotal,
      tax,
      shippingCost,
      total,
    };
  }
}
