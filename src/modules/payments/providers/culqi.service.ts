import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CulqiChargeRequest {
  amount: number; // In cents (187.59 PEN = 18759)
  currency_code: string;
  email: string;
  source_id: string; // Token from Culqi.js
  description?: string;
  metadata?: Record<string, string>;
}

export interface CulqiChargeResponse {
  id: string;
  amount: number;
  currency_code: string;
  email: string;
  description: string;
  source: {
    card_number: string;
    card_brand: string;
  };
  outcome: {
    type: string;
    code: string;
    merchant_message: string;
    user_message: string;
  };
  created_at: number;
}

export interface CulqiRefundRequest {
  charge_id: string;
  amount: number;
  reason: string;
}

export interface CulqiRefundResponse {
  id: string;
  charge_id: string;
  amount: number;
  reason: string;
  created_at: number;
}

@Injectable()
export class CulqiService {
  private readonly logger = new Logger(CulqiService.name);
  private readonly apiUrl = 'https://api.culqi.com/v2';
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('CULQI_SECRET_KEY') || '';
  }

  async createCharge(data: CulqiChargeRequest): Promise<CulqiChargeResponse> {
    this.logger.log(`Creating Culqi charge for ${data.email}`);

    try {
      const response = await fetch(`${this.apiUrl}/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Culqi charge failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(
          result.user_message || result.merchant_message || 'Payment failed',
        );
      }

      this.logger.log(`Culqi charge created: ${result.id}`);
      return result as CulqiChargeResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Culqi API error: ${error}`);
      throw new BadRequestException('Payment processing error');
    }
  }

  async createRefund(data: CulqiRefundRequest): Promise<CulqiRefundResponse> {
    this.logger.log(`Creating Culqi refund for charge ${data.charge_id}`);

    try {
      const response = await fetch(`${this.apiUrl}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Culqi refund failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(
          result.user_message || result.merchant_message || 'Refund failed',
        );
      }

      this.logger.log(`Culqi refund created: ${result.id}`);
      return result as CulqiRefundResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Culqi API error: ${error}`);
      throw new BadRequestException('Refund processing error');
    }
  }

  async getCharge(chargeId: string): Promise<CulqiChargeResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/charges/${chargeId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new BadRequestException('Charge not found');
      }

      return result as CulqiChargeResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Culqi API error: ${error}`);
      throw new BadRequestException('Error fetching charge');
    }
  }

  convertToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  convertFromCents(cents: number): number {
    return cents / 100;
  }
}
