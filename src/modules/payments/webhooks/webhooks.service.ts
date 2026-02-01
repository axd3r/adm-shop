import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Payment } from '../entities/payment.entity';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus, PaymentProvider } from '../enums';
import { OrderStatus } from '../../orders/enums';
import {
  CulqiWebhookEvent,
  MercadoPagoWebhookEvent,
  StripeWebhookEvent,
  WebhookResultDto,
} from '../dto/webhook-event.dto';
import { MercadoPagoService } from '../providers/mercadopago.service';
import { EmailService } from '../../notifications/services/email.service';
import { PushService } from '../../notifications/services/push.service';
import { PaymentEmailContext } from '../../notifications/interfaces/email-options.interface';
import { PaymentNotificationData } from '../../notifications/interfaces/push-notification.interface';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  private readonly culqiWebhookSecret: string;
  private readonly stripeWebhookSecret: string;
  private readonly mercadoPagoWebhookSecret: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
  ) {
    this.culqiWebhookSecret =
      this.configService.get<string>('CULQI_WEBHOOK_SECRET') || '';
    this.stripeWebhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.mercadoPagoWebhookSecret =
      this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET') || '';
  }

  // ==================== CULQI WEBHOOK ====================
  async handleCulqiWebhook(
    payload: CulqiWebhookEvent,
    signature: string,
    rawBody: string,
  ): Promise<WebhookResultDto> {
    this.logger.log(`Received Culqi webhook: ${payload.type}`);

    // Validate signature
    if (this.culqiWebhookSecret) {
      const isValid = this.verifyCulqiSignature(rawBody, signature);
      if (!isValid) {
        throw new UnauthorizedException('Invalid Culqi webhook signature');
      }
    }

    try {
      const chargeId = payload.data.object.id;
      const payment = await this.findPaymentByExternalId(
        chargeId,
        PaymentProvider.CULQI,
      );

      if (!payment) {
        this.logger.warn(`Payment not found for Culqi charge: ${chargeId}`);
        return {
          success: true,
          message: 'Payment not found, event ignored',
          eventId: chargeId,
          eventType: payload.type,
        };
      }

      switch (payload.type) {
        case 'charge.creation.succeeded':
          await this.markPaymentCompleted(payment);
          break;

        case 'charge.creation.failed':
          await this.markPaymentFailed(
            payment,
            payload.data.object.outcome?.code || 'Unknown error',
          );
          break;

        case 'refund.creation.succeeded':
          await this.markPaymentRefunded(payment);
          break;

        default:
          this.logger.log(`Unhandled Culqi event type: ${payload.type}`);
      }

      return {
        success: true,
        message: `Culqi event ${payload.type} processed`,
        eventId: chargeId,
        eventType: payload.type,
      };
    } catch (error) {
      this.logger.error(`Error processing Culqi webhook: ${error}`);
      throw new BadRequestException('Failed to process Culqi webhook');
    }
  }

  private verifyCulqiSignature(rawBody: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.culqiWebhookSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  // ==================== MERCADOPAGO WEBHOOK ====================
  async handleMercadoPagoWebhook(
    payload: MercadoPagoWebhookEvent,
    xSignature: string,
    xRequestId: string,
  ): Promise<WebhookResultDto> {
    this.logger.log(
      `Received MercadoPago webhook: ${payload.type} - ${payload.action}`,
    );

    // Validate signature if secret is configured
    if (this.mercadoPagoWebhookSecret && xSignature) {
      const isValid = this.verifyMercadoPagoSignature(
        payload.data.id,
        xSignature,
        xRequestId,
      );
      if (!isValid) {
        throw new UnauthorizedException(
          'Invalid MercadoPago webhook signature',
        );
      }
    }

    try {
      // Only process payment events
      if (payload.type !== 'payment') {
        return {
          success: true,
          message: `Event type ${payload.type} ignored`,
          eventId: payload.id.toString(),
          eventType: payload.type,
        };
      }

      // Fetch payment details from MercadoPago
      const mpPayment = await this.mercadoPagoService.getPayment(
        parseInt(payload.data.id),
      );

      const payment = await this.findPaymentByExternalId(
        payload.data.id,
        PaymentProvider.MERCADOPAGO,
      );

      if (!payment) {
        this.logger.warn(
          `Payment not found for MercadoPago ID: ${payload.data.id}`,
        );
        return {
          success: true,
          message: 'Payment not found, event ignored',
          eventId: payload.data.id,
          eventType: payload.type,
        };
      }

      // Update based on MercadoPago payment status
      switch (mpPayment.status) {
        case 'approved':
          await this.markPaymentCompleted(payment);
          break;

        case 'rejected':
        case 'cancelled':
          await this.markPaymentFailed(payment, mpPayment.status_detail);
          break;

        case 'refunded':
          await this.markPaymentRefunded(payment);
          break;

        case 'pending':
        case 'in_process':
        case 'authorized':
          // Payment still pending, update status
          if (payment.status !== PaymentStatus.PENDING) {
            payment.status = PaymentStatus.PENDING;
            await this.paymentRepository.save(payment);
          }
          break;

        default:
          this.logger.log(`Unhandled MercadoPago status: ${mpPayment.status}`);
      }

      return {
        success: true,
        message: `MercadoPago payment ${mpPayment.status} processed`,
        eventId: payload.data.id,
        eventType: `${payload.type}.${mpPayment.status}`,
      };
    } catch (error) {
      this.logger.error(`Error processing MercadoPago webhook: ${error}`);
      throw new BadRequestException('Failed to process MercadoPago webhook');
    }
  }

  private verifyMercadoPagoSignature(
    dataId: string,
    xSignature: string,
    xRequestId: string,
  ): boolean {
    // Parse x-signature header: ts=xxx,v1=xxx
    const parts = xSignature.split(',');
    const signatureParts: Record<string, string> = {};

    for (const part of parts) {
      const [key, value] = part.split('=');
      signatureParts[key] = value;
    }

    const ts = signatureParts['ts'];
    const v1 = signatureParts['v1'];

    if (!ts || !v1) {
      return false;
    }

    // Build manifest string
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const expectedSignature = crypto
      .createHmac('sha256', this.mercadoPagoWebhookSecret)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature));
  }

  // ==================== STRIPE WEBHOOK ====================
  async handleStripeWebhook(
    payload: StripeWebhookEvent,
    signature: string,
    rawBody: string,
  ): Promise<WebhookResultDto> {
    this.logger.log(`Received Stripe webhook: ${payload.type}`);

    // Validate signature
    if (this.stripeWebhookSecret) {
      const isValid = this.verifyStripeSignature(rawBody, signature);
      if (!isValid) {
        throw new UnauthorizedException('Invalid Stripe webhook signature');
      }
    }

    try {
      const eventObject = payload.data.object;
      let paymentIntentId: string;

      // Get payment_intent ID based on event type
      if (eventObject.object === 'payment_intent') {
        paymentIntentId = eventObject.id;
      } else if (eventObject.object === 'charge') {
        paymentIntentId = eventObject.payment_intent || eventObject.id;
      } else {
        return {
          success: true,
          message: `Event object ${eventObject.object} ignored`,
          eventId: payload.id,
          eventType: payload.type,
        };
      }

      const payment = await this.findPaymentByExternalId(
        paymentIntentId,
        PaymentProvider.STRIPE,
      );

      if (!payment) {
        this.logger.warn(
          `Payment not found for Stripe PaymentIntent: ${paymentIntentId}`,
        );
        return {
          success: true,
          message: 'Payment not found, event ignored',
          eventId: payload.id,
          eventType: payload.type,
        };
      }

      switch (payload.type) {
        case 'payment_intent.succeeded':
        case 'charge.succeeded':
          await this.markPaymentCompleted(payment, eventObject);
          break;

        case 'payment_intent.payment_failed':
          await this.markPaymentFailed(
            payment,
            'Payment failed',
          );
          break;

        case 'charge.refunded':
          await this.markPaymentRefunded(payment);
          break;

        default:
          this.logger.log(`Unhandled Stripe event type: ${payload.type}`);
      }

      return {
        success: true,
        message: `Stripe event ${payload.type} processed`,
        eventId: payload.id,
        eventType: payload.type,
      };
    } catch (error) {
      this.logger.error(`Error processing Stripe webhook: ${error}`);
      throw new BadRequestException('Failed to process Stripe webhook');
    }
  }

  private verifyStripeSignature(rawBody: string, signature: string): boolean {
    // Parse Stripe signature header: t=xxx,v1=xxx,v0=xxx
    const elements = signature.split(',');
    const signatureElements: Record<string, string> = {};

    for (const element of elements) {
      const [key, value] = element.split('=');
      signatureElements[key] = value;
    }

    const timestamp = signatureElements['t'];
    const v1Signature = signatureElements['v1'];

    if (!timestamp || !v1Signature) {
      return false;
    }

    // Check timestamp is within tolerance (5 minutes)
    const tolerance = 300; // 5 minutes in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - parseInt(timestamp) > tolerance) {
      this.logger.warn('Stripe webhook timestamp too old');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.stripeWebhookSecret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature),
    );
  }

  // ==================== COMMON METHODS ====================
  private async findPaymentByExternalId(
    externalId: string,
    provider: PaymentProvider,
  ): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { externalId, provider },
      relations: ['order', 'user'],
    });
  }

  private async markPaymentCompleted(
    payment: Payment,
    providerData?: Record<string, unknown>,
  ): Promise<void> {
    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(
        `Payment ${payment.referenceNumber} already completed, skipping`,
      );
      return;
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();

    if (providerData) {
      payment.providerResponse = {
        ...payment.providerResponse,
        webhookData: providerData,
      };
    }

    await this.paymentRepository.save(payment);

    // Update order status
    await this.orderRepository.update(payment.orderId, {
      status: OrderStatus.PAID,
      paidAt: new Date(),
    });

    this.logger.log(
      `Payment ${payment.referenceNumber} marked as completed via webhook`,
    );

    // Send success email notification
    await this.sendPaymentSuccessEmail(payment);
  }

  private async markPaymentFailed(
    payment: Payment,
    errorMessage: string,
  ): Promise<void> {
    if (
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.COMPLETED
    ) {
      return;
    }

    payment.status = PaymentStatus.FAILED;
    payment.errorMessage = errorMessage;

    await this.paymentRepository.save(payment);

    this.logger.log(
      `Payment ${payment.referenceNumber} marked as failed: ${errorMessage}`,
    );

    // Send failed email notification
    await this.sendPaymentFailedEmail(payment, errorMessage);
  }

  private async markPaymentRefunded(payment: Payment): Promise<void> {
    if (payment.status === PaymentStatus.REFUNDED) {
      return;
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.refundedAt = new Date();

    await this.paymentRepository.save(payment);

    // Update order status
    await this.orderRepository.update(payment.orderId, {
      status: OrderStatus.REFUNDED,
    });

    this.logger.log(
      `Payment ${payment.referenceNumber} marked as refunded via webhook`,
    );

    // Send refund email notification
    await this.sendPaymentRefundedEmail(payment);
  }

  // ==================== NOTIFICATION HELPERS ====================
  private buildEmailContext(payment: Payment): PaymentEmailContext {
    return {
      customerName: payment.user?.fullName || 'Cliente',
      customerEmail: payment.user?.email || '',
      orderNumber: payment.order?.orderNumber || '',
      paymentReference: payment.referenceNumber,
      amount: Number(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.method,
      cardMask: payment.cardMask,
      cardBrand: payment.cardBrand,
      paidAt: payment.paidAt
        ? new Date(payment.paidAt).toLocaleString('es-PE', {
            dateStyle: 'long',
            timeStyle: 'short',
          })
        : new Date().toLocaleString('es-PE', {
            dateStyle: 'long',
            timeStyle: 'short',
          }),
      total: Number(payment.amount),
      supportEmail: '',
      companyName: '',
    };
  }

  private buildPushNotificationData(
    payment: Payment,
    errorMessage?: string,
  ): PaymentNotificationData {
    return {
      paymentId: payment.id,
      paymentReference: payment.referenceNumber,
      orderId: payment.orderId,
      orderNumber: payment.order?.orderNumber || '',
      amount: Number(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      cardMask: payment.cardMask,
      errorMessage,
    };
  }

  // ==================== EMAIL NOTIFICATIONS ====================
  private async sendPaymentSuccessEmail(payment: Payment): Promise<void> {
    if (!payment.user?.email) {
      this.logger.warn(
        `Cannot send success email: no user email for payment ${payment.referenceNumber}`,
      );
      return;
    }

    try {
      const context = this.buildEmailContext(payment);
      await this.emailService.sendPaymentSuccessEmail(context);
      this.logger.log(`Payment success email sent to ${payment.user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send payment success email: ${error}`);
    }

    // Send push notification
    this.sendPaymentSuccessPush(payment);
  }

  private async sendPaymentFailedEmail(
    payment: Payment,
    errorMessage: string,
  ): Promise<void> {
    if (!payment.user?.email) {
      this.logger.warn(
        `Cannot send failed email: no user email for payment ${payment.referenceNumber}`,
      );
      return;
    }

    try {
      const context = this.buildEmailContext(payment);
      await this.emailService.sendPaymentFailedEmail({
        ...context,
        errorMessage,
      });
      this.logger.log(`Payment failed email sent to ${payment.user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send payment failed email: ${error}`);
    }

    // Send push notification
    this.sendPaymentFailedPush(payment, errorMessage);
  }

  private async sendPaymentRefundedEmail(payment: Payment): Promise<void> {
    if (!payment.user?.email) {
      this.logger.warn(
        `Cannot send refund email: no user email for payment ${payment.referenceNumber}`,
      );
      return;
    }

    try {
      const context = this.buildEmailContext(payment);
      await this.emailService.sendPaymentRefundedEmail(context);
      this.logger.log(`Payment refund email sent to ${payment.user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send payment refund email: ${error}`);
    }

    // Send push notification
    this.sendPaymentRefundedPush(payment);
  }

  // ==================== PUSH NOTIFICATIONS ====================
  private sendPaymentSuccessPush(payment: Payment): void {
    if (!payment.userId) {
      return;
    }

    try {
      const data = this.buildPushNotificationData(payment);
      this.pushService.notifyPaymentSuccess(payment.userId, data);
      this.logger.log(`Payment success push sent to user ${payment.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send payment success push: ${error}`);
    }
  }

  private sendPaymentFailedPush(payment: Payment, errorMessage: string): void {
    if (!payment.userId) {
      return;
    }

    try {
      const data = this.buildPushNotificationData(payment, errorMessage);
      this.pushService.notifyPaymentFailed(payment.userId, data);
      this.logger.log(`Payment failed push sent to user ${payment.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send payment failed push: ${error}`);
    }
  }

  private sendPaymentRefundedPush(payment: Payment): void {
    if (!payment.userId) {
      return;
    }

    try {
      const data = this.buildPushNotificationData(payment);
      this.pushService.notifyPaymentRefunded(payment.userId, data);
      this.logger.log(`Payment refund push sent to user ${payment.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send payment refund push: ${error}`);
    }
  }
}
