import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus, PaymentProvider, PaymentMethod } from '../enums';
import { User } from '../../users/entities/user.entity';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashed',
    isActive: true,
    roles: ['user'],
  } as User;

  const mockPayment: Payment = {
    id: 'payment-123',
    referenceNumber: 'PAY-20260115-0001',
    userId: mockUser.id,
    orderId: 'order-123',
    status: PaymentStatus.COMPLETED,
    provider: PaymentProvider.CULQI,
    method: PaymentMethod.CREDIT_CARD,
    amount: 100.0,
    currency: 'PEN',
    externalId: 'chr_test_123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Payment;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createPayment: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByOrder: jest.fn(),
            refundPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      const createDto: CreatePaymentDto = {
        orderId: 'order-123',
        provider: PaymentProvider.CULQI,
        token: 'tkn_test_123',
        method: PaymentMethod.CREDIT_CARD,
        email: 'test@example.com',
      };

      paymentsService.createPayment.mockResolvedValue(mockPayment);

      const result = await controller.createPayment(createDto, mockUser);

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        createDto,
        mockUser,
      );
      expect(result).toEqual(mockPayment);
    });
  });

  describe('findAll', () => {
    it('should return user payments', async () => {
      paymentsService.findAll.mockResolvedValue([mockPayment]);

      const result = await controller.findAll(mockUser);

      expect(paymentsService.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findAllAdmin', () => {
    it('should return all payments for admin', async () => {
      paymentsService.findAll.mockResolvedValue([mockPayment]);

      const result = await controller.findAllAdmin();

      expect(paymentsService.findAll).toHaveBeenCalledWith();
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findOne', () => {
    it('should return a payment by ID', async () => {
      paymentsService.findOne.mockResolvedValue(mockPayment);

      const result = await controller.findOne(mockPayment.id);

      expect(paymentsService.findOne).toHaveBeenCalledWith(mockPayment.id);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('findByOrder', () => {
    it('should return payments for an order', async () => {
      paymentsService.findByOrder.mockResolvedValue([mockPayment]);

      const result = await controller.findByOrder('order-123');

      expect(paymentsService.findByOrder).toHaveBeenCalledWith('order-123');
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment', async () => {
      const refundDto: RefundPaymentDto = {
        amount: 50,
        reason: 'Customer request',
      };

      const refundedPayment = {
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      };

      paymentsService.refundPayment.mockResolvedValue(refundedPayment);

      const result = await controller.refundPayment(mockPayment.id, refundDto);

      expect(paymentsService.refundPayment).toHaveBeenCalledWith(
        mockPayment.id,
        refundDto,
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });
  });
});
