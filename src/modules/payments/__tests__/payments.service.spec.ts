import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { Payment } from '../entities/payment.entity';
import { Order } from '../../orders/entities/order.entity';
import { CulqiService } from '../providers/culqi.service';
import { MercadoPagoService } from '../providers/mercadopago.service';
import { StripeService } from '../providers/stripe.service';
import { PaymentStatus, PaymentProvider, PaymentMethod } from '../enums';
import { OrderStatus } from '../../orders/enums';
import { User } from '../../users/entities/user.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let culqiService: jest.Mocked<CulqiService>;
  let mercadoPagoService: jest.Mocked<MercadoPagoService>;
  let stripeService: jest.Mocked<StripeService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashed',
    isActive: true,
    roles: ['user'],
    product: null,
    orders: [],
    cart: null,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  } as unknown as User;

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'ORD-20260115-0001',
    userId: mockUser.id,
    user: mockUser,
    status: OrderStatus.PENDING,
    total: 100.0,
    currency: 'PEN',
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Order;

  const mockPayment = {
    id: 'payment-123',
    referenceNumber: 'PAY-20260115-0001',
    userId: mockUser.id,
    user: mockUser,
    orderId: mockOrder.id,
    order: mockOrder,
    status: PaymentStatus.PENDING,
    provider: PaymentProvider.CULQI,
    method: PaymentMethod.CREDIT_CARD,
    amount: 100.0,
    currency: 'PEN',
    externalId: null as unknown as string,
    cardMask: null as unknown as string,
    cardBrand: null as unknown as string,
    providerResponse: null as unknown as Record<string, any>,
    errorMessage: null as unknown as string,
    paidAt: null as unknown as Date,
    refundedAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Payment;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
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
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CulqiService,
          useValue: {
            createCharge: jest.fn(),
            createRefund: jest.fn(),
            convertToCents: jest.fn((amount) => Math.round(amount * 100)),
          },
        },
        {
          provide: MercadoPagoService,
          useValue: {
            createPayment: jest.fn(),
            createRefund: jest.fn(),
            isPaymentApproved: jest.fn(),
            isPendingPayment: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: jest.fn(),
            createRefund: jest.fn(),
            isPaymentSucceeded: jest.fn(),
            requiresAction: jest.fn(),
            convertToCents: jest.fn((amount) => Math.round(amount * 100)),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get(getRepositoryToken(Payment));
    orderRepository = module.get(getRepositoryToken(Order));
    culqiService = module.get(CulqiService);
    mercadoPagoService = module.get(MercadoPagoService);
    stripeService = module.get(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const createPaymentDto = {
      orderId: 'order-123',
      provider: PaymentProvider.CULQI,
      token: 'tkn_test_123',
      method: PaymentMethod.CREDIT_CARD,
      email: 'test@example.com',
      description: 'Test payment',
    };

    it('should create a payment successfully with Culqi', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue(null); // No existing payment
      paymentRepository.count.mockResolvedValue(0);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);

      culqiService.createCharge.mockResolvedValue({
        id: 'chr_test_123',
        amount: 10000,
        currency_code: 'PEN',
        email: 'test@example.com',
        description: 'Test',
        source: { card_number: '****4242', card_brand: 'VISA' },
        outcome: {
          type: 'venta_exitosa',
          code: 'AUT0000',
          merchant_message: '',
          user_message: '',
        },
        created_at: Date.now(),
      });

      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        externalId: 'chr_test_123',
      };
      paymentRepository.findOne
        .mockResolvedValueOnce(null) // Check existing
        .mockResolvedValueOnce(completedPayment); // Final find

      const result = await service.createPayment(createPaymentDto, mockUser);

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: createPaymentDto.orderId, userId: mockUser.id },
      });
      expect(culqiService.createCharge).toHaveBeenCalled();
      expect(paymentRepository.save).toHaveBeenCalled();
      expect(orderRepository.update).toHaveBeenCalledWith(mockOrder.id, {
        status: OrderStatus.PAID,
        paidAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createPayment(createPaymentDto, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order already paid', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      await expect(
        service.createPayment(createPaymentDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order status is invalid', async () => {
      orderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await expect(
        service.createPayment(createPaymentDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle Culqi payment failure', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.count.mockResolvedValue(0);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);

      culqiService.createCharge.mockRejectedValue(
        new BadRequestException('Insufficient funds'),
      );

      await expect(
        service.createPayment(createPaymentDto, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.FAILED,
          errorMessage: 'Insufficient funds',
        }),
      );
    });

    it('should create payment with MercadoPago', async () => {
      const mpDto = {
        ...createPaymentDto,
        provider: PaymentProvider.MERCADOPAGO,
      };

      orderRepository.findOne.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.count.mockResolvedValue(0);
      paymentRepository.create.mockReturnValue({
        ...mockPayment,
        provider: PaymentProvider.MERCADOPAGO,
      });
      paymentRepository.save.mockResolvedValue(mockPayment);

      mercadoPagoService.createPayment.mockResolvedValue({
        id: 12345,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'PEN',
        description: 'Test',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 1,
        payer: { email: 'test@example.com' },
        external_reference: 'ORD-123',
        date_created: new Date().toISOString(),
        date_approved: new Date().toISOString(),
      });
      mercadoPagoService.isPaymentApproved.mockReturnValue(true);

      paymentRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockPayment,
          status: PaymentStatus.COMPLETED,
        });

      await service.createPayment(mpDto, mockUser);

      expect(mercadoPagoService.createPayment).toHaveBeenCalled();
    });

    it('should create payment with Stripe', async () => {
      const stripeDto = {
        ...createPaymentDto,
        provider: PaymentProvider.STRIPE,
      };

      orderRepository.findOne.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.count.mockResolvedValue(0);
      paymentRepository.create.mockReturnValue({
        ...mockPayment,
        provider: PaymentProvider.STRIPE,
      });
      paymentRepository.save.mockResolvedValue(mockPayment);

      stripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        object: 'payment_intent',
        amount: 10000,
        amount_received: 10000,
        currency: 'pen',
        status: 'succeeded',
        description: 'Test',
        receipt_email: 'test@example.com',
        payment_method: 'pm_test',
        payment_method_types: ['card'],
        metadata: {},
        created: Date.now(),
        charges: {
          data: [
            {
              id: 'ch_test',
              payment_method_details: {
                card: {
                  brand: 'visa',
                  last4: '4242',
                  exp_month: 12,
                  exp_year: 2030,
                },
              },
            },
          ],
        },
      });
      stripeService.isPaymentSucceeded.mockReturnValue(true);
      stripeService.requiresAction.mockReturnValue(false);

      paymentRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockPayment,
          status: PaymentStatus.COMPLETED,
        });

      await service.createPayment(stripeDto, mockUser);

      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    const refundDto = { amount: 50, reason: 'Customer request' };
    const completedPayment = {
      ...mockPayment,
      status: PaymentStatus.COMPLETED,
      externalId: 'chr_test_123',
    };

    it('should refund a Culqi payment', async () => {
      paymentRepository.findOne.mockResolvedValue(completedPayment);
      culqiService.createRefund.mockResolvedValue({
        id: 'ref_test_123',
        charge_id: 'chr_test_123',
        amount: 5000,
        reason: 'Customer request',
        created_at: Date.now(),
      });

      const refundedPayment = {
        ...completedPayment,
        status: PaymentStatus.REFUNDED,
      };
      paymentRepository.findOne
        .mockResolvedValueOnce(completedPayment)
        .mockResolvedValueOnce(refundedPayment);

      const result = await service.refundPayment(
        completedPayment.id,
        refundDto,
      );

      expect(culqiService.createRefund).toHaveBeenCalledWith({
        charge_id: 'chr_test_123',
        amount: 5000,
        reason: 'Customer request',
      });
      expect(orderRepository.update).toHaveBeenCalledWith(mockOrder.id, {
        status: OrderStatus.REFUNDED,
      });
    });

    it('should throw BadRequestException if payment not completed', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment); // PENDING status

      await expect(
        service.refundPayment(mockPayment.id, refundDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no external reference', async () => {
      paymentRepository.findOne.mockResolvedValue({
        ...completedPayment,
        externalId: null,
      } as unknown as Payment);

      await expect(
        service.refundPayment(mockPayment.id, refundDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      paymentRepository.find.mockResolvedValue([mockPayment]);

      const result = await service.findAll();

      expect(result).toEqual([mockPayment]);
      expect(paymentRepository.find).toHaveBeenCalledWith({
        where: {},
        relations: ['order', 'user'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter by userId', async () => {
      paymentRepository.find.mockResolvedValue([mockPayment]);

      await service.findAll(mockUser.id);

      expect(paymentRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        relations: ['order', 'user'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a payment', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne(mockPayment.id);

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByOrder', () => {
    it('should return payments for an order', async () => {
      paymentRepository.find.mockResolvedValue([mockPayment]);

      const result = await service.findByOrder(mockOrder.id);

      expect(result).toEqual([mockPayment]);
      expect(paymentRepository.find).toHaveBeenCalledWith({
        where: { orderId: mockOrder.id },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
