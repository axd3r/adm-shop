import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StripeService } from '../providers/stripe.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('sk_test_secret_key'),
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    const paymentRequest = {
      amount: 10000,
      currency: 'pen',
      payment_method: 'pm_test_123',
      description: 'Test payment',
      receipt_email: 'test@example.com',
      confirm: true,
    };

    it('should create a payment intent successfully', async () => {
      const mockResponse = {
        id: 'pi_test_123',
        object: 'payment_intent',
        amount: 10000,
        amount_received: 10000,
        currency: 'pen',
        status: 'succeeded',
        description: 'Test payment',
        receipt_email: 'test@example.com',
        payment_method: 'pm_test_123',
        payment_method_types: ['card'],
        metadata: {},
        created: Date.now(),
        charges: {
          data: [
            {
              id: 'ch_test_123',
              status: 'succeeded',
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
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createPaymentIntent(paymentRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/payment_intents',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Bearer sk_test_secret_key',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle requires_action status', async () => {
      const mockResponse = {
        id: 'pi_test_123',
        status: 'requires_action',
        client_secret: 'pi_test_123_secret',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createPaymentIntent(paymentRequest);

      expect(result.status).toBe('requires_action');
    });

    it('should throw BadRequestException on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: {
              message: 'Your card was declined.',
              type: 'card_error',
              code: 'card_declined',
            },
          }),
      });

      await expect(service.createPaymentIntent(paymentRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirmPaymentIntent', () => {
    it('should confirm a payment intent', async () => {
      const mockResponse = {
        id: 'pi_test_123',
        status: 'succeeded',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.confirmPaymentIntent('pi_test_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/payment_intents/pi_test_123/confirm',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result.status).toBe('succeeded');
    });
  });

  describe('createRefund', () => {
    const refundRequest = {
      payment_intent: 'pi_test_123',
      amount: 5000,
      reason: 'requested_by_customer' as const,
    };

    it('should create a refund successfully', async () => {
      const mockResponse = {
        id: 're_test_123',
        object: 'refund',
        amount: 5000,
        currency: 'pen',
        payment_intent: 'pi_test_123',
        status: 'succeeded',
        reason: 'requested_by_customer',
        created: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createRefund(refundRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/refunds',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException on refund failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: { message: 'Charge already refunded' },
          }),
      });

      await expect(service.createRefund(refundRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPaymentIntent', () => {
    it('should get payment intent details', async () => {
      const mockResponse = {
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 10000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.getPaymentIntent('pi_test_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/payment_intents/pi_test_123',
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('isPaymentSucceeded', () => {
    it('should return true for succeeded status', () => {
      expect(service.isPaymentSucceeded('succeeded')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(service.isPaymentSucceeded('requires_action')).toBe(false);
      expect(service.isPaymentSucceeded('processing')).toBe(false);
      expect(service.isPaymentSucceeded('canceled')).toBe(false);
    });
  });

  describe('requiresAction', () => {
    it('should return true for action-required statuses', () => {
      expect(service.requiresAction('requires_action')).toBe(true);
      expect(service.requiresAction('requires_confirmation')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(service.requiresAction('succeeded')).toBe(false);
      expect(service.requiresAction('processing')).toBe(false);
    });
  });

  describe('convertToCents', () => {
    it('should convert amount to cents', () => {
      expect(service.convertToCents(100)).toBe(10000);
      expect(service.convertToCents(99.99)).toBe(9999);
      expect(service.convertToCents(0.01)).toBe(1);
    });
  });

  describe('convertFromCents', () => {
    it('should convert cents to amount', () => {
      expect(service.convertFromCents(10000)).toBe(100);
      expect(service.convertFromCents(9999)).toBe(99.99);
      expect(service.convertFromCents(1)).toBe(0.01);
    });
  });
});
