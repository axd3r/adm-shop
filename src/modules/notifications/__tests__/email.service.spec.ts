import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../services/email.service';
import { EmailTemplate } from '../interfaces/email-options.interface';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn((callback) => callback(null)),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;

  const mockConfigValues: Record<string, string | number> = {
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@test.com',
    SMTP_PASS: 'password',
    SMTP_FROM_EMAIL: 'noreply@test.com',
    SMTP_FROM_NAME: 'Test Shop',
    COMPANY_NAME: 'Test Company',
    SUPPORT_EMAIL: 'support@test.com',
  };

  const basePaymentContext = {
    customerName: 'John Doe',
    customerEmail: 'john@test.com',
    orderNumber: 'ORD-001',
    paymentReference: 'PAY-001',
    paidAt: '2026-01-17',
    paymentMethod: 'VISA',
    amount: 100,
    total: 100,
    currency: 'PEN',
    supportEmail: 'support@test.com',
    companyName: 'Test Company',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with SMTP config', () => {
      expect(configService.get).toHaveBeenCalledWith('SMTP_HOST');
      expect(configService.get).toHaveBeenCalledWith('SMTP_PORT');
      expect(configService.get).toHaveBeenCalledWith('SMTP_USER');
      expect(configService.get).toHaveBeenCalledWith('SMTP_PASS');
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const result = await service.sendEmail({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        template: EmailTemplate.PAYMENT_SUCCESS,
        context: basePaymentContext,
      });

      expect(result).toBe(true);
    });
  });

  describe('sendPaymentSuccessEmail', () => {
    it('should send payment success email', async () => {
      const result = await service.sendPaymentSuccessEmail(basePaymentContext);

      expect(result).toBe(true);
    });

    it('should include items in payment success email', async () => {
      const result = await service.sendPaymentSuccessEmail({
        ...basePaymentContext,
        items: [{ name: 'Product 1', quantity: 2, price: 50 }],
        subtotal: 100,
        shipping: 0,
      });

      expect(result).toBe(true);
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('should send payment failed email', async () => {
      const result = await service.sendPaymentFailedEmail({
        ...basePaymentContext,
        errorMessage: 'Card declined',
      });

      expect(result).toBe(true);
    });
  });

  describe('sendPaymentRefundedEmail', () => {
    it('should send payment refunded email', async () => {
      const result = await service.sendPaymentRefundedEmail(basePaymentContext);

      expect(result).toBe(true);
    });
  });

  describe('without SMTP config', () => {
    it('should warn and return false when SMTP not configured', async () => {
      const moduleWithoutSmtp: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const serviceWithoutSmtp =
        moduleWithoutSmtp.get<EmailService>(EmailService);

      const result = await serviceWithoutSmtp.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        template: EmailTemplate.PAYMENT_SUCCESS,
        context: {},
      });

      expect(result).toBe(false);
    });
  });
});
