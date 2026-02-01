import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from '../webhooks/webhooks.service';
import { Payment } from '../entities/payment.entity';
import { Order } from '../../orders/entities/order.entity';
import { MercadoPagoService } from '../providers/mercadopago.service';
import { EmailService } from '../../notifications/services/email.service';
import { PushService } from '../../notifications/services/push.service';
import { PaymentStatus, PaymentProvider, PaymentMethod } from '../enums';
import { OrderStatus } from '../../orders/enums';
import { User } from '../../users/entities/user.entity';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let mercadoPagoService: jest.Mocked<MercadoPagoService>;
  let emailService: jest.Mocked<EmailService>;
  let pushService: jest.Mocked<PushService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashed',
    isActive: true,
    roles: ['user'],
  } as User;

  const mockOrder: Order = {
    id: 'order-123',
    orderNumber: 'ORD-20260115-0001',
    userId: mockUser.id,
    user: mockUser,
    status: OrderStatus.PENDING,
    total: 100.0,
    currency: 'PEN',
  } as Order;

  const mockPayment: Payment = {
    id: 'payment-123',
    referenceNumber: 'PAY-20260115-0001',
    userId: mockUser.id,
    user: mockUser,
    orderId: mockOrder.id,
    order: mockOrder,
    status: PaymentStatus.PROCESSING,
    provider: PaymentProvider.CULQI,
    method: PaymentMethod.CREDIT_CARD,
    amount: 100.0,
    currency: 'PEN',
    externalId: 'chr_test_123',
  } as Payment;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              // Return empty strings to skip signature validation in tests
              const config: Record<string, string> = {
                CULQI_WEBHOOK_SECRET: '',
                STRIPE_WEBHOOK_SECRET: '',
                MERCADOPAGO_WEBHOOK_SECRET: '',
              };
              return config[key] || '';
            }),
          },
        },
        {
          provide: MercadoPagoService,
          useValue: {
            getPayment: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPaymentSuccessEmail: jest.fn(),
            sendPaymentFailedEmail: jest.fn(),
            sendPaymentRefundedEmail: jest.fn(),
          },
        },
        {
          provide: PushService,
          useValue: {
            notifyPaymentSuccess: jest.fn(),
            notifyPaymentFailed: jest.fn(),
            notifyPaymentRefunded: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    paymentRepository = module.get(getRepositoryToken(Payment));
    orderRepository = module.get(getRepositoryToken(Order));
    mercadoPagoService = module.get(MercadoPagoService);
    emailService = module.get(EmailService);
    pushService = module.get(PushService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCulqiWebhook', () => {
    const culqiEvent = {
      object: 'event',
      type: 'charge.creation.succeeded',
      data: {
        object: {
          id: 'chr_test_123',
          amount: 10000,
          currency_code: 'PEN',
          email: 'test@example.com',
          outcome: { type: 'venta_exitosa', code: 'AUT0000' },
        },
      },
      created: Date.now(),
    };

    it('should process charge.creation.succeeded event', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);
      paymentRepository.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      // Skip signature validation for this test
      const result = await service.handleCulqiWebhook(
        culqiEvent,
        '',
        JSON.stringify(culqiEvent),
      );

      expect(result.success).toBe(true);
      expect(result.eventType).toBe('charge.creation.succeeded');
      expect(paymentRepository.save).toHaveBeenCalled();
      expect(orderRepository.update).toHaveBeenCalledWith(mockOrder.id, {
        status: OrderStatus.PAID,
        paidAt: expect.any(Date),
      });
    });

    it('should process charge.creation.failed event', async () => {
      const failedEvent = {
        ...culqiEvent,
        type: 'charge.creation.failed',
      };

      const processingPayment = {
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      };
      paymentRepository.findOne.mockResolvedValue(processingPayment);
      paymentRepository.save.mockImplementation(
        async (payment) => payment as Payment,
      );

      const result = await service.handleCulqiWebhook(
        failedEvent,
        '',
        JSON.stringify(failedEvent),
      );

      expect(result.success).toBe(true);
      expect(paymentRepository.save).toHaveBeenCalled();
      // Verify the payment status was updated
      const savedPayment = paymentRepository.save.mock.calls[0][0] as Payment;
      expect(savedPayment.status).toBe(PaymentStatus.FAILED);
    });

    it('should ignore event if payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      const result = await service.handleCulqiWebhook(
        culqiEvent,
        '',
        JSON.stringify(culqiEvent),
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('not found');
    });

    it('should skip if payment already completed', async () => {
      paymentRepository.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.handleCulqiWebhook(
        culqiEvent,
        '',
        JSON.stringify(culqiEvent),
      );

      expect(result.success).toBe(true);
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('handleMercadoPagoWebhook', () => {
    const mpEvent = {
      id: 12345,
      live_mode: false,
      type: 'payment',
      date_created: new Date().toISOString(),
      user_id: '123456',
      api_version: 'v1',
      action: 'payment.updated',
      data: { id: '98765' },
    };

    it('should process approved payment', async () => {
      const mpPayment = {
        ...mockPayment,
        provider: PaymentProvider.MERCADOPAGO,
        externalId: '98765',
        status: PaymentStatus.PROCESSING,
      };
      paymentRepository.findOne.mockResolvedValue(mpPayment);
      paymentRepository.save.mockImplementation(
        async (payment) => payment as Payment,
      );

      mercadoPagoService.getPayment.mockResolvedValue({
        id: 98765,
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

      const result = await service.handleMercadoPagoWebhook(mpEvent, '', '');

      expect(result.success).toBe(true);
      expect(mercadoPagoService.getPayment).toHaveBeenCalledWith(98765);
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should handle rejected payment', async () => {
      const mpPayment = {
        ...mockPayment,
        provider: PaymentProvider.MERCADOPAGO,
        externalId: '98765',
        status: PaymentStatus.PROCESSING,
      };
      paymentRepository.findOne.mockResolvedValue(mpPayment);
      paymentRepository.save.mockImplementation(
        async (payment) => payment as Payment,
      );

      mercadoPagoService.getPayment.mockResolvedValue({
        id: 98765,
        status: 'rejected',
        status_detail: 'cc_rejected_insufficient_amount',
      } as any);

      const result = await service.handleMercadoPagoWebhook(mpEvent, '', '');

      expect(result.success).toBe(true);
      expect(paymentRepository.save).toHaveBeenCalled();
      const savedPayment = paymentRepository.save.mock.calls[0][0] as Payment;
      expect(savedPayment.status).toBe(PaymentStatus.FAILED);
    });

    it('should ignore non-payment events', async () => {
      const otherEvent = { ...mpEvent, type: 'merchant_order' };

      const result = await service.handleMercadoPagoWebhook(otherEvent, '', '');

      expect(result.success).toBe(true);
      expect(result.message).toContain('ignored');
    });
  });

  describe('handleStripeWebhook', () => {
    const stripeEvent = {
      id: 'evt_test_123',
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.succeeded',
      livemode: false,
      data: {
        object: {
          id: 'pi_test_123',
          object: 'payment_intent',
          amount: 10000,
          amount_received: 10000,
          currency: 'pen',
          status: 'succeeded',
          metadata: {},
        },
      },
    };

    it('should process payment_intent.succeeded event', async () => {
      paymentRepository.findOne.mockResolvedValue({
        ...mockPayment,
        provider: PaymentProvider.STRIPE,
        externalId: 'pi_test_123',
      });

      const result = await service.handleStripeWebhook(
        stripeEvent,
        '',
        JSON.stringify(stripeEvent),
      );

      expect(result.success).toBe(true);
      expect(result.eventType).toBe('payment_intent.succeeded');
    });

    it('should process charge.refunded event', async () => {
      const refundEvent = {
        ...stripeEvent,
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test_123',
            object: 'charge',
            amount: 10000,
            currency: 'pen',
            payment_intent: 'pi_test_123',
            status: 'succeeded',
          },
        },
      } as any;

      paymentRepository.findOne.mockResolvedValue({
        ...mockPayment,
        provider: PaymentProvider.STRIPE,
        externalId: 'pi_test_123',
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.handleStripeWebhook(
        refundEvent,
        '',
        JSON.stringify(refundEvent),
      );

      expect(result.success).toBe(true);
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
        }),
      );
    });
  });

  describe('email and push notifications', () => {
    const culqiEvent = {
      object: 'event',
      type: 'charge.creation.succeeded',
      data: {
        object: {
          id: 'chr_test_123',
          amount: 10000,
          currency_code: 'PEN',
          email: 'test@example.com',
          outcome: { type: 'venta_exitosa', code: 'AUT0000' },
        },
      },
      created: Date.now(),
    };

    it('should send email notification on payment success', async () => {
      const processingPayment = {
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      };
      paymentRepository.findOne.mockResolvedValue(processingPayment);
      paymentRepository.save.mockImplementation(
        async (payment) => payment as Payment,
      );

      await service.handleCulqiWebhook(
        culqiEvent,
        '',
        JSON.stringify(culqiEvent),
      );

      expect(emailService.sendPaymentSuccessEmail).toHaveBeenCalled();
    });

    it('should send push notification on payment success', async () => {
      const processingPayment = {
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      };
      paymentRepository.findOne.mockResolvedValue(processingPayment);
      paymentRepository.save.mockImplementation(
        async (payment) => payment as Payment,
      );

      await service.handleCulqiWebhook(
        culqiEvent,
        '',
        JSON.stringify(culqiEvent),
      );

      expect(pushService.notifyPaymentSuccess).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          paymentId: mockPayment.id,
          amount: mockPayment.amount,
        }),
      );
    });
  });
});
