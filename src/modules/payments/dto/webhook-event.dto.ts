import { ApiProperty } from '@nestjs/swagger';

// Culqi Webhook Event
export interface CulqiWebhookEvent {
  object: string;
  type: string;
  data: {
    object: {
      id: string;
      amount: number;
      currency_code: string;
      email: string;
      outcome: {
        type: string;
        code: string;
      };
      metadata?: Record<string, string>;
    };
  };
  created: number;
}

// MercadoPago Webhook Event (IPN)
export interface MercadoPagoWebhookEvent {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// Stripe Webhook Event
export interface StripeWebhookEvent {
  id: string;
  object: string;
  api_version: string;
  created: number;
  type: string;
  livemode: boolean;
  data: {
    object: {
      id: string;
      object: string;
      amount: number;
      amount_received?: number;
      currency: string;
      status: string;
      payment_intent?: string;
      metadata?: Record<string, string>;
      charges?: {
        data: Array<{
          id: string;
          status: string;
          payment_method_details?: {
            card?: {
              brand: string;
              last4: string;
            };
          };
        }>;
      };
    };
  };
}

// Webhook processing result
export class WebhookResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Event processed successfully' })
  message: string;

  @ApiProperty({ example: 'evt_123456', required: false })
  eventId?: string;

  @ApiProperty({ example: 'payment.succeeded', required: false })
  eventType?: string;
}

// Supported webhook event types
export enum WebhookEventType {
  // Culqi events
  CULQI_CHARGE_CREATION_SUCCEEDED = 'charge.creation.succeeded',
  CULQI_CHARGE_CREATION_FAILED = 'charge.creation.failed',
  CULQI_REFUND_CREATION_SUCCEEDED = 'refund.creation.succeeded',

  // MercadoPago events
  MP_PAYMENT_CREATED = 'payment.created',
  MP_PAYMENT_UPDATED = 'payment.updated',

  // Stripe events
  STRIPE_PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  STRIPE_PAYMENT_INTENT_FAILED = 'payment_intent.payment_failed',
  STRIPE_CHARGE_REFUNDED = 'charge.refunded',
  STRIPE_CHARGE_SUCCEEDED = 'charge.succeeded',
}
