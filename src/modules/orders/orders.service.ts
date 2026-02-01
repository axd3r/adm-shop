import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './enums';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOrderDto: CreateOrderDto, user: User): Promise<Order> {
    const { items, shippingAddress, billingAddress, notes } = createOrderDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate products and calculate totals
      let subtotal = 0;
      const orderItems: Partial<OrderItem>[] = [];

      for (const item of items) {
        const product = await this.productRepository.findOne({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        const itemSubtotal = item.price * item.quantity;
        subtotal += itemSubtotal;

        orderItems.push({
          productId: product.id,
          productTitle: product.title,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          subtotal: itemSubtotal,
        });
      }

      // Calculate order totals
      const tax = subtotal * 0.18; // 18% IGV Peru
      const shippingCost = subtotal >= 100 ? 0 : 10; // Free shipping over 100
      const total = subtotal + tax + shippingCost;

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Create order
      const order = queryRunner.manager.create(Order, {
        orderNumber,
        userId: user.id,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        notes,
        subtotal,
        tax,
        shippingCost,
        total,
        status: OrderStatus.PENDING,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // Create order items
      await Promise.all(
        orderItems.map((item) =>
          queryRunner.manager.save(
            queryRunner.manager.create(OrderItem, {
              ...item,
              orderId: savedOrder.id,
            }),
          ),
        ),
      );

      await queryRunner.commitTransaction();

      this.logger.log(`Order ${orderNumber} created for user ${user.id}`);

      return this.findOne(savedOrder.id, user.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllAdmin(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['items', 'items.product', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findForSeller(sellerId: string): Promise<Order[]> {
    // Find orders that contain products owned by this seller
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.user', 'user')
      .where('product.sellerId = :sellerId', { sellerId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();

    return orders;
  }

  async findOne(id: string, userId?: string): Promise<Order> {
    const whereCondition: { id: string; userId?: string } = { id };
    if (userId) {
      whereCondition.userId = userId;
    }

    const order = await this.orderRepository.findOne({
      where: whereCondition,
      relations: ['items', 'items.product', 'user'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const { status } = updateOrderStatusDto;

    // Validate status transitions
    this.validateStatusTransition(order.status, status);

    // Update timestamps based on status
    const updates: Partial<Order> = { status };

    if (status === OrderStatus.PAID && !order.paidAt) {
      updates.paidAt = new Date();
    } else if (status === OrderStatus.SHIPPED && !order.shippedAt) {
      updates.shippedAt = new Date();
    } else if (status === OrderStatus.DELIVERED && !order.deliveredAt) {
      updates.deliveredAt = new Date();
    }

    await this.orderRepository.update(id, updates);

    this.logger.log(`Order ${order.orderNumber} status updated to ${status}`);

    return this.findOne(id);
  }

  async cancel(id: string, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Only pending or confirmed orders can be cancelled',
      );
    }

    await this.orderRepository.update(id, { status: OrderStatus.CANCELLED });

    this.logger.log(`Order ${order.orderNumber} cancelled by user ${userId}`);

    return this.findOne(id, userId);
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.CONFIRMED,
        OrderStatus.PAID,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.CONFIRMED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await this.orderRepository.count({
      where: {},
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `ORD-${dateStr}-${sequence}`;
  }
}
