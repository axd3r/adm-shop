import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CulqiService } from '../providers/culqi.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('CulqiService', () => {
  let service: CulqiService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CulqiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('sk_test_secret_key'),
          },
        },
      ],
    }).compile();

    service = module.get<CulqiService>(CulqiService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCharge', () => {
    const chargeRequest = {
      amount: 10000,
      currency_code: 'PEN',
      email: 'test@example.com',
      source_id: 'tkn_test_123',
      description: 'Test charge',
    };

    it('should create a charge successfully', async () => {
      const mockResponse = {
        id: 'chr_test_123',
        amount: 10000,
        currency_code: 'PEN',
        email: 'test@example.com',
        description: 'Test charge',
        source: { card_number: '****4242', card_brand: 'VISA' },
        outcome: {
          type: 'venta_exitosa',
          code: 'AUT0000',
          merchant_message: 'Success',
          user_message: 'Success',
        },
        created_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createCharge(chargeRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.culqi.com/v2/charges',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk_test_secret_key',
          },
          body: JSON.stringify(chargeRequest),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            user_message: 'Insufficient funds',
            merchant_message: 'Card declined',
          }),
      });

      await expect(service.createCharge(chargeRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.createCharge(chargeRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createRefund', () => {
    const refundRequest = {
      charge_id: 'chr_test_123',
      amount: 5000,
      reason: 'Customer request',
    };

    it('should create a refund successfully', async () => {
      const mockResponse = {
        id: 'ref_test_123',
        charge_id: 'chr_test_123',
        amount: 5000,
        reason: 'Customer request',
        created_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.createRefund(refundRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.culqi.com/v2/refunds',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException on refund failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ user_message: 'Refund not allowed' }),
      });

      await expect(service.createRefund(refundRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getCharge', () => {
    it('should get charge details', async () => {
      const mockResponse = {
        id: 'chr_test_123',
        amount: 10000,
        status: 'succeeded',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.getCharge('chr_test_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.culqi.com/v2/charges/chr_test_123',
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException if charge not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Not found' }),
      });

      await expect(service.getCharge('invalid')).rejects.toThrow(
        BadRequestException,
      );
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
