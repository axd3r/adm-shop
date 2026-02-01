export enum NotificationType {
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_PENDING = 'payment.pending',
  ORDER_CREATED = 'order.created',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_CANCELLED = 'order.cancelled',
  CART_REMINDER = 'cart.reminder',
  PROMO_ALERT = 'promo.alert',
  SYSTEM = 'system',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface PushNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  data?: Record<string, unknown>;
  timestamp: Date;
  read: boolean;
}

export interface PaymentNotificationData {
  paymentId: string;
  paymentReference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  provider: string;
  cardMask?: string;
  errorMessage?: string;
  [key: string]: unknown;
}
