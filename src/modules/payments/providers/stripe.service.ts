import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StripePaymentIntentRequest {
  amount: number; // In cents
  currency: string;
  payment_method: string;
  description?: string;
  receipt_email?: string;
  metadata?: Record<string, string>;
  confirm?: boolean;
  return_url?: string;
}

export interface StripePaymentIntentResponse {
  id: string;
  object: string;
  amount: number;
  amount_received: number;
  currency: string;
  status: string;
  description: string;
  receipt_email: string;
  payment_method: string;
  payment_method_types: string[];
  metadata: Record<string, string>;
  created: number;
  charges?: {
    data: Array<{
      id: string;
      payment_method_details?: {
        card?: {
          brand: string;
          last4: string;
          exp_month: number;
          exp_year: number;
        };
      };
    }>;
  };
}

export interface StripeRefundRequest {
  payment_intent: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface StripeRefundResponse {
  id: string;
  object: string;
  amount: number;
  currency: string;
  payment_intent: string;
  status: string;
  reason: string;
  created: number;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly apiUrl = 'https://api.stripe.com/v1';
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
  }

  async createPaymentIntent(
    data: StripePaymentIntentRequest,
  ): Promise<StripePaymentIntentResponse> {
    this.logger.log(`Creating Stripe PaymentIntent for ${data.receipt_email}`);

    try {
      const body = new URLSearchParams();
      body.append('amount', data.amount.toString());
      body.append('currency', data.currency.toLowerCase());
      body.append('payment_method', data.payment_method);
      body.append('confirm', (data.confirm ?? true).toString());

      if (data.description) {
        body.append('description', data.description);
      }
      if (data.receipt_email) {
        body.append('receipt_email', data.receipt_email);
      }
      if (data.return_url) {
        body.append('return_url', data.return_url);
      }
      if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
          body.append(`metadata[${key}]`, value);
        });
      }

      const response = await fetch(`${this.apiUrl}/payment_intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: body.toString(),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Stripe payment failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(
          result.error?.message || 'Payment failed',
        );
      }

      if (result.status === 'requires_action') {
        this.logger.warn(
          `Stripe PaymentIntent ${result.id} requires additional action`,
        );
      }

      this.logger.log(`Stripe PaymentIntent created: ${result.id}`);
      return result as StripePaymentIntentResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Stripe API error: ${error}`);
      throw new BadRequestException('Payment processing error');
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethod?: string,
  ): Promise<StripePaymentIntentResponse> {
    this.logger.log(`Confirming Stripe PaymentIntent ${paymentIntentId}`);

    try {
      const body = new URLSearchParams();
      if (paymentMethod) {
        body.append('payment_method', paymentMethod);
      }

      const response = await fetch(
        `${this.apiUrl}/payment_intents/${paymentIntentId}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${this.secretKey}`,
          },
          body: body.toString(),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Stripe confirm failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(
          result.error?.message || 'Payment confirmation failed',
        );
      }

      return result as StripePaymentIntentResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Stripe API error: ${error}`);
      throw new BadRequestException('Payment confirmation error');
    }
  }

  async createRefund(data: StripeRefundRequest): Promise<StripeRefundResponse> {
    this.logger.log(`Creating Stripe refund for ${data.payment_intent}`);

    try {
      const body = new URLSearchParams();
      body.append('payment_intent', data.payment_intent);

      if (data.amount) {
        body.append('amount', data.amount.toString());
      }
      if (data.reason) {
        body.append('reason', data.reason);
      }
      if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
          body.append(`metadata[${key}]`, value);
        });
      }

      const response = await fetch(`${this.apiUrl}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: body.toString(),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`Stripe refund failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(
          result.error?.message || 'Refund failed',
        );
      }

      this.logger.log(`Stripe refund created: ${result.id}`);
      return result as StripeRefundResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Stripe API error: ${error}`);
      throw new BadRequestException('Refund processing error');
    }
  }

  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<StripePaymentIntentResponse> {
    try {
      const response = await fetch(
        `${this.apiUrl}/payment_intents/${paymentIntentId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new BadRequestException('PaymentIntent not found');
      }

      return result as StripePaymentIntentResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Stripe API error: ${error}`);
      throw new BadRequestException('Error fetching payment');
    }
  }

  isPaymentSucceeded(status: string): boolean {
    return status === 'succeeded';
  }

  requiresAction(status: string): boolean {
    return status === 'requires_action' || status === 'requires_confirmation';
  }

  convertToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  convertFromCents(cents: number): number {
    return cents / 100;
  }
}
