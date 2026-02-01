import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MercadoPagoPaymentRequest {
  transaction_amount: number;
  token: string;
  description: string;
  installments: number;
  payment_method_id: string;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  external_reference?: string;
  metadata?: Record<string, string>;
}

export interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  description: string;
  payment_method_id: string;
  payment_type_id: string;
  installments: number;
  card?: {
    first_six_digits: string;
    last_four_digits: string;
  };
  payer: {
    email: string;
  };
  external_reference: string;
  date_created: string;
  date_approved: string;
}

export interface MercadoPagoRefundRequest {
  amount?: number;
}

export interface MercadoPagoRefundResponse {
  id: number;
  payment_id: number;
  amount: number;
  status: string;
  date_created: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly apiUrl = 'https://api.mercadopago.com/v1';
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') || '';
  }

  async createPayment(
    data: MercadoPagoPaymentRequest,
  ): Promise<MercadoPagoPaymentResponse> {
    this.logger.log(`Creating MercadoPago payment for ${data.payer.email}`);

    try {
      const response = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'X-Idempotency-Key': this.generateIdempotencyKey(),
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`MercadoPago payment failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(
          result.message || this.getErrorMessage(result.cause),
        );
      }

      if (result.status === 'rejected') {
        throw new BadRequestException(
          this.getRejectionMessage(result.status_detail),
        );
      }

      this.logger.log(`MercadoPago payment created: ${result.id}`);
      return result as MercadoPagoPaymentResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`MercadoPago API error: ${error}`);
      throw new BadRequestException('Payment processing error');
    }
  }

  async createRefund(
    paymentId: number,
    data?: MercadoPagoRefundRequest,
  ): Promise<MercadoPagoRefundResponse> {
    this.logger.log(`Creating MercadoPago refund for payment ${paymentId}`);

    try {
      const response = await fetch(
        `${this.apiUrl}/payments/${paymentId}/refunds`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'X-Idempotency-Key': this.generateIdempotencyKey(),
          },
          body: data ? JSON.stringify(data) : undefined,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`MercadoPago refund failed: ${JSON.stringify(result)}`);
        throw new BadRequestException(result.message || 'Refund failed');
      }

      this.logger.log(`MercadoPago refund created: ${result.id}`);
      return result as MercadoPagoRefundResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`MercadoPago API error: ${error}`);
      throw new BadRequestException('Refund processing error');
    }
  }

  async getPayment(paymentId: number): Promise<MercadoPagoPaymentResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new BadRequestException('Payment not found');
      }

      return result as MercadoPagoPaymentResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`MercadoPago API error: ${error}`);
      throw new BadRequestException('Error fetching payment');
    }
  }

  isPaymentApproved(status: string): boolean {
    return status === 'approved';
  }

  isPendingPayment(status: string): boolean {
    return ['pending', 'in_process', 'authorized'].includes(status);
  }

  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private getErrorMessage(cause?: Array<{ code: string; description: string }>): string {
    if (!cause || cause.length === 0) {
      return 'Payment failed';
    }
    return cause.map((c) => c.description).join(', ');
  }

  private getRejectionMessage(statusDetail: string): string {
    const messages: Record<string, string> = {
      cc_rejected_bad_filled_card_number: 'Invalid card number',
      cc_rejected_bad_filled_date: 'Invalid expiration date',
      cc_rejected_bad_filled_other: 'Invalid card data',
      cc_rejected_bad_filled_security_code: 'Invalid security code',
      cc_rejected_blacklist: 'Card not allowed',
      cc_rejected_call_for_authorize: 'Call to authorize payment',
      cc_rejected_card_disabled: 'Card disabled',
      cc_rejected_duplicated_payment: 'Duplicated payment',
      cc_rejected_high_risk: 'Payment rejected by fraud prevention',
      cc_rejected_insufficient_amount: 'Insufficient funds',
      cc_rejected_invalid_installments: 'Invalid installments',
      cc_rejected_max_attempts: 'Maximum attempts exceeded',
      cc_rejected_other_reason: 'Payment rejected',
    };

    return messages[statusDetail] || 'Payment rejected';
  }
}
