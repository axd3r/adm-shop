import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { MercadoPagoService } from '../providers/mercadopago.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MercadoPagoService', () => {
  let service: MercadoPagoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadoPagoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('TEST-access-token'),
          },
        },
      ],
    }).compile();

    service = module.get<MercadoPagoService>(MercadoPagoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const paymentRequest = {
      transaction_amount: 100,
      token: 'card_token_123',
      description: 'Test payment',
      installments: 1,
      payment_method_id: 'visa',
      payer: {
        email: 'test@example.com',
      },
    };

    it('should create a payment successfully', async () => {
      const mockResponse = {
        id: 12345678,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'PEN',
        description: 'Test payment',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 1,
        card: {
          first_six_digits: '424242',
          last_four_digits: '4242',
        },
        payer: { email: 'test@example.com' },
        external_reference: '',
        date_created: new Date().toISOString(),
        date_approved: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createPayment(paymentRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer TEST-access-token',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException on rejected payment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 12345,
            status: 'rejected',
            status_detail: 'cc_rejected_insufficient_amount',
          }),
      });

      await expect(service.createPayment(paymentRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            message: 'Invalid token',
            cause: [{ code: 'invalid_token', description: 'Token is invalid' }],
          }),
      });

      await expect(service.createPayment(paymentRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createRefund', () => {
    it('should create a full refund', async () => {
      const mockResponse = {
        id: 98765,
        payment_id: 12345,
        amount: 100,
        status: 'approved',
        date_created: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createRefund(12345);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments/12345/refunds',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should create a partial refund', async () => {
      const mockResponse = {
        id: 98765,
        payment_id: 12345,
        amount: 50,
        status: 'approved',
        date_created: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createRefund(12345, { amount: 50 });

      expect(result.amount).toBe(50);
    });
  });

  describe('getPayment', () => {
    it('should get payment details', async () => {
      const mockResponse = {
        id: 12345,
        status: 'approved',
        transaction_amount: 100,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.getPayment(12345);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments/12345',
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('isPaymentApproved', () => {
    it('should return true for approved status', () => {
      expect(service.isPaymentApproved('approved')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(service.isPaymentApproved('pending')).toBe(false);
      expect(service.isPaymentApproved('rejected')).toBe(false);
      expect(service.isPaymentApproved('cancelled')).toBe(false);
    });
  });

  describe('isPendingPayment', () => {
    it('should return true for pending statuses', () => {
      expect(service.isPendingPayment('pending')).toBe(true);
      expect(service.isPendingPayment('in_process')).toBe(true);
      expect(service.isPendingPayment('authorized')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(service.isPendingPayment('approved')).toBe(false);
      expect(service.isPendingPayment('rejected')).toBe(false);
    });
  });
});
