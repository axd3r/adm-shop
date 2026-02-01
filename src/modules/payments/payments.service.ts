import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentStatus, PaymentProvider } from './enums';
import { OrderStatus } from '../orders/enums';
import { CulqiService } from './providers/culqi.service';
import { MercadoPagoService } from './providers/mercadopago.service';
import { StripeService } from './providers/stripe.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly culqiService: CulqiService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly stripeService: StripeService,
  ) {}

  async createPayment(
    createPaymentDto: CreatePaymentDto,
    user: User,
  ): Promise<Payment> {
    const { orderId, provider } = createPaymentDto;

    // Validate order
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId: user.id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException('Order cannot be paid in current status');
    }

    // Check if order already has a successful payment
    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId, status: PaymentStatus.COMPLETED },
    });

    if (existingPayment) {
      throw new BadRequestException('Order has already been paid');
    }

    // Generate reference number
    const referenceNumber = await this.generateReferenceNumber();

    // Create payment record
    const payment = this.paymentRepository.create({
      referenceNumber,
      userId: user.id,
      orderId,
      provider,
      method: createPaymentDto.method,
      amount: order.total,
      currency: order.currency,
      status: PaymentStatus.PROCESSING,
    });

    await this.paymentRepository.save(payment);

    try {
      // Process payment based on provider
      switch (provider) {
        case PaymentProvider.CULQI:
          await this.processCulqiPayment(payment, order, createPaymentDto);
          break;
        case PaymentProvider.MERCADOPAGO:
          await this.processMercadoPagoPayment(payment, order, createPaymentDto);
          break;
        case PaymentProvider.STRIPE:
          await this.processStripePayment(payment, order, createPaymentDto);
          break;
        default:
          throw new BadRequestException(`Unsupported provider: ${provider}`);
      }

      // Update order status
      await this.orderRepository.update(orderId, {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      });

      this.logger.log(
        `Payment ${referenceNumber} completed via ${provider} for order ${order.orderNumber}`,
      );

      return this.findOne(payment.id);
    } catch (error) {
      // Update payment with failure
      payment.status = PaymentStatus.FAILED;
      payment.errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.paymentRepository.save(payment);

      this.logger.error(
        `Payment ${referenceNumber} failed: ${payment.errorMessage}`,
      );

      throw error;
    }
  }

  private async processCulqiPayment(
    payment: Payment,
    order: Order,
    dto: CreatePaymentDto,
  ): Promise<void> {
    const chargeResult = await this.culqiService.createCharge({
      amount: this.culqiService.convertToCents(Number(order.total)),
      currency_code: order.currency,
      email: dto.email,
      source_id: dto.token,
      description: dto.description || `Orden ${order.orderNumber}`,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        payment_id: payment.id,
      },
    });

    payment.status = PaymentStatus.COMPLETED;
    payment.externalId = chargeResult.id;
    payment.cardMask = chargeResult.source?.card_number;
    payment.cardBrand = chargeResult.source?.card_brand;
    payment.providerResponse = chargeResult;
    payment.paidAt = new Date();

    await this.paymentRepository.save(payment);
  }

  private async processMercadoPagoPayment(
    payment: Payment,
    order: Order,
    dto: CreatePaymentDto,
  ): Promise<void> {
    const paymentResult = await this.mercadoPagoService.createPayment({
      transaction_amount: Number(order.total),
      token: dto.token,
      description: dto.description || `Orden ${order.orderNumber}`,
      installments: dto.installments || 1,
      payment_method_id: dto.paymentMethodId || 'visa',
      payer: {
        email: dto.email,
        identification: dto.identification,
      },
      external_reference: order.orderNumber,
      metadata: {
        order_id: order.id,
        payment_id: payment.id,
      },
    });

    if (!this.mercadoPagoService.isPaymentApproved(paymentResult.status)) {
      if (this.mercadoPagoService.isPendingPayment(paymentResult.status)) {
        payment.status = PaymentStatus.PENDING;
      } else {
        throw new BadRequestException(
          `Payment ${paymentResult.status}: ${paymentResult.status_detail}`,
        );
      }
    } else {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();
    }

    payment.externalId = paymentResult.id.toString();
    if (paymentResult.card) {
      payment.cardMask = `${paymentResult.card.first_six_digits}...${paymentResult.card.last_four_digits}`;
    }
    payment.cardBrand = paymentResult.payment_method_id;
    payment.providerResponse = paymentResult;

    await this.paymentRepository.save(payment);
  }

  private async processStripePayment(
    payment: Payment,
    order: Order,
    dto: CreatePaymentDto,
  ): Promise<void> {
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: this.stripeService.convertToCents(Number(order.total)),
      currency: order.currency,
      payment_method: dto.token,
      description: dto.description || `Orden ${order.orderNumber}`,
      receipt_email: dto.email,
      confirm: true,
      return_url: dto.returnUrl,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        payment_id: payment.id,
      },
    });

    if (this.stripeService.requiresAction(paymentIntent.status)) {
      payment.status = PaymentStatus.PENDING;
      payment.providerResponse = {
        ...paymentIntent,
        requires_action: true,
      };
    } else if (this.stripeService.isPaymentSucceeded(paymentIntent.status)) {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();

      const cardDetails =
        paymentIntent.charges?.data[0]?.payment_method_details?.card;
      if (cardDetails) {
        payment.cardMask = `****${cardDetails.last4}`;
        payment.cardBrand = cardDetails.brand;
      }
    } else {
      throw new BadRequestException(
        `Payment failed with status: ${paymentIntent.status}`,
      );
    }

    payment.externalId = paymentIntent.id;
    payment.providerResponse = paymentIntent;

    await this.paymentRepository.save(payment);
  }

  async refundPayment(
    id: string,
    refundPaymentDto: RefundPaymentDto,
  ): Promise<Payment> {
    const payment = await this.findOne(id);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    if (!payment.externalId) {
      throw new BadRequestException('Payment has no external reference');
    }

    const refundAmount = refundPaymentDto.amount || Number(payment.amount);

    try {
      let refundResult: unknown;

      switch (payment.provider) {
        case PaymentProvider.CULQI:
          refundResult = await this.culqiService.createRefund({
            charge_id: payment.externalId,
            amount: this.culqiService.convertToCents(refundAmount),
            reason: refundPaymentDto.reason || 'Requested by admin',
          });
          break;

        case PaymentProvider.MERCADOPAGO:
          refundResult = await this.mercadoPagoService.createRefund(
            parseInt(payment.externalId),
            refundAmount < Number(payment.amount)
              ? { amount: refundAmount }
              : undefined,
          );
          break;

        case PaymentProvider.STRIPE:
          refundResult = await this.stripeService.createRefund({
            payment_intent: payment.externalId,
            amount: this.stripeService.convertToCents(refundAmount),
            reason: 'requested_by_customer',
          });
          break;

        default:
          throw new BadRequestException(
            `Refund not supported for provider: ${payment.provider}`,
          );
      }

      payment.status = PaymentStatus.REFUNDED;
      payment.refundedAt = new Date();
      payment.providerResponse = {
        ...payment.providerResponse,
        refund: refundResult,
      };

      await this.paymentRepository.save(payment);

      // Update order status
      await this.orderRepository.update(payment.orderId, {
        status: OrderStatus.REFUNDED,
      });

      this.logger.log(
        `Payment ${payment.referenceNumber} refunded via ${payment.provider}`,
      );

      return this.findOne(id);
    } catch (error) {
      this.logger.error(`Refund failed for payment ${id}: ${error}`);
      throw error;
    }
  }

  async findAll(userId?: string): Promise<Payment[]> {
    const whereCondition = userId ? { userId } : {};

    return this.paymentRepository.find({
      where: whereCondition,
      relations: ['order', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order', 'user'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByOrder(orderId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  private async generateReferenceNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await this.paymentRepository.count();
    const sequence = String(count + 1).padStart(4, '0');

    return `PAY-${dateStr}-${sequence}`;
  }
}
