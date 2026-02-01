import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { User } from '../../users/entities/user.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: ['user'],
  } as User;

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'ORD-20260117-0001',
    userId: 'user-123',
    user: mockUser,
    status: OrderStatus.PENDING,
    subtotal: 100,
    tax: 18,
    total: 118,
    items: [],
  } as unknown as Order;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findAllAdmin: jest.fn(),
            findOne: jest.fn(),
            updateStatus: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
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
        },
      ],
      shippingAddress: 'Test Address',
    };

    it('should create an order', async () => {
      service.create.mockResolvedValue(mockOrder);

      const result = await controller.create(createOrderDto, mockUser);

      expect(result).toEqual(mockOrder);
      expect(service.create).toHaveBeenCalledWith(createOrderDto, mockUser);
    });
  });

  describe('findAll', () => {
    it('should return all orders for user', async () => {
      service.findAll.mockResolvedValue([mockOrder]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([mockOrder]);
      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('findAllAdmin', () => {
    it('should return all orders for admin', async () => {
      service.findAllAdmin.mockResolvedValue([mockOrder]);

      const result = await controller.findAllAdmin();

      expect(result).toEqual([mockOrder]);
      expect(service.findAllAdmin).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a specific order', async () => {
      service.findOne.mockResolvedValue(mockOrder);

      const result = await controller.findOne('order-123', mockUser);

      expect(result).toEqual(mockOrder);
      expect(service.findOne).toHaveBeenCalledWith('order-123', mockUser.id);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const updatedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      service.updateStatus.mockResolvedValue(updatedOrder);

      const result = await controller.updateStatus('order-123', {
        status: OrderStatus.CONFIRMED,
      });

      expect(result).toEqual(updatedOrder);
      expect(service.updateStatus).toHaveBeenCalledWith('order-123', {
        status: OrderStatus.CONFIRMED,
      });
    });
  });

  describe('cancel', () => {
    it('should cancel an order', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      service.cancel.mockResolvedValue(cancelledOrder);

      const result = await controller.cancel('order-123', mockUser);

      expect(result).toEqual(cancelledOrder);
      expect(service.cancel).toHaveBeenCalledWith('order-123', mockUser.id);
    });
  });
});
