export interface EmailOptions {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: Record<string, unknown>;
}

export enum EmailTemplate {
  PAYMENT_SUCCESS = 'payment-success',
  PAYMENT_FAILED = 'payment-failed',
  PAYMENT_REFUNDED = 'payment-refunded',
  ORDER_CONFIRMED = 'order-confirmed',
  WELCOME = 'welcome',
}

export interface PaymentEmailContext {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  paymentReference: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  cardMask?: string;
  cardBrand?: string;
  paidAt: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal?: number;
  shipping?: number;
  total: number;
  supportEmail: string;
  companyName: string;
}
