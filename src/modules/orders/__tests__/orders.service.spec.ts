import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let orderItemRepository: jest.Mocked<Repository<OrderItem>>;
  let productRepository: jest.Mocked<Repository<Product>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: ['user'],
  } as User;

  const mockProduct = {
    id: 'product-123',
    title: 'Test Product',
    price: 50.0,
    stock: 10,
  } as unknown as Product;

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'ORD-20260117-0001',
    userId: 'user-123',
    user: mockUser,
    status: OrderStatus.PENDING,
    subtotal: 100,
    tax: 18,
    shippingCost: 0,
    total: 118,
    items: [],
    shippingAddress: 'Test Address',
    billingAddress: 'Test Address',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Order;

  const mockOrderItem = {
    id: 'item-123',
    orderId: 'order-123',
    productId: 'product-123',
    productTitle: 'Test Product',
    price: 50,
    quantity: 2,
    subtotal: 100,
  } as unknown as OrderItem;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  } as unknown as QueryRunner;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get(getRepositoryToken(Order));
    orderItemRepository = module.get(getRepositoryToken(OrderItem));
    productRepository = module.get(getRepositoryToken(Product));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createOrderDto = {
      items: [
        {
          productId: 'product-123',
          quantity: 2,
          price: 50,
          size: 'M',
        },
      ],
      shippingAddress: 'Test Address',
    };

    it('should create an order successfully', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);
      orderRepository.count.mockResolvedValue(0);
      (mockQueryRunner.manager.create as jest.Mock).mockReturnValue(mockOrder);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue(mockOrder);
      orderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        items: [mockOrderItem],
      });

      const result = await service.create(createOrderDto, mockUser);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toHaveProperty('orderNumber');
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createOrderDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      productRepository.findOne.mockRejectedValue(new Error('DB Error'));

      await expect(service.create(createOrderDto, mockUser)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all orders for a user', async () => {
      orderRepository.find.mockResolvedValue([mockOrder]);

      const result = await service.findAll('user-123');

      expect(result).toEqual([mockOrder]);
      expect(orderRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        relations: ['items', 'items.product'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAllAdmin', () => {
    it('should return all orders for admin', async () => {
      orderRepository.find.mockResolvedValue([mockOrder]);

      const result = await service.findAllAdmin();

      expect(result).toEqual([mockOrder]);
      expect(orderRepository.find).toHaveBeenCalledWith({
        relations: ['items', 'items.product', 'user'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-123');

      expect(result).toEqual(mockOrder);
    });

    it('should return order filtered by userId', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-123', 'user-123');

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123', userId: 'user-123' },
        relations: ['items', 'items.product', 'user'],
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      orderRepository.findOne
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.CONFIRMED });

      const result = await service.updateStatus('order-123', {
        status: OrderStatus.CONFIRMED,
      });

      expect(orderRepository.update).toHaveBeenCalledWith('order-123', {
        status: OrderStatus.CONFIRMED,
      });
    });

    it('should set paidAt when status is PAID', async () => {
      orderRepository.findOne
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.PAID });

      await service.updateStatus('order-123', { status: OrderStatus.PAID });

      expect(orderRepository.update).toHaveBeenCalledWith(
        'order-123',
        expect.objectContaining({
          status: OrderStatus.PAID,
          paidAt: expect.any(Date),
        }),
      );
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      orderRepository.findOne.mockResolvedValue(cancelledOrder);

      await expect(
        service.updateStatus('order-123', { status: OrderStatus.PAID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel a pending order', async () => {
      orderRepository.findOne
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.CANCELLED });

      const result = await service.cancel('order-123', 'user-123');

      expect(orderRepository.update).toHaveBeenCalledWith('order-123', {
        status: OrderStatus.CANCELLED,
      });
    });

    it('should cancel a confirmed order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      orderRepository.findOne
        .mockResolvedValueOnce(confirmedOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.CANCELLED });

      await service.cancel('order-123', 'user-123');

      expect(orderRepository.update).toHaveBeenCalledWith('order-123', {
        status: OrderStatus.CANCELLED,
      });
    });

    it('should throw BadRequestException if order cannot be cancelled', async () => {
      const shippedOrder = { ...mockOrder, status: OrderStatus.SHIPPED };
      orderRepository.findOne.mockResolvedValue(shippedOrder);

      await expect(service.cancel('order-123', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
