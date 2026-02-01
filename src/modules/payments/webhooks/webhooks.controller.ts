import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import {
  CulqiWebhookEvent,
  MercadoPagoWebhookEvent,
  StripeWebhookEvent,
  WebhookResultDto,
} from '../dto/webhook-event.dto';

@ApiTags('Payment Webhooks')
@Controller('payments/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('culqi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Culqi webhook events' })
  @ApiHeader({
    name: 'x-culqi-signature',
    description: 'Culqi webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResultDto,
  })
  async handleCulqi(
    @Body() payload: CulqiWebhookEvent,
    @Headers('x-culqi-signature') signature: string,
    @Req() req: Request,
  ): Promise<WebhookResultDto> {
    const rawBody = JSON.stringify(req.body);
    return this.webhooksService.handleCulqiWebhook(
      payload,
      signature || '',
      rawBody,
    );
  }

  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle MercadoPago webhook events (IPN)' })
  @ApiHeader({
    name: 'x-signature',
    description: 'MercadoPago webhook signature',
    required: false,
  })
  @ApiHeader({
    name: 'x-request-id',
    description: 'MercadoPago request ID',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResultDto,
  })
  async handleMercadoPago(
    @Body() payload: MercadoPagoWebhookEvent,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ): Promise<WebhookResultDto> {
    return this.webhooksService.handleMercadoPagoWebhook(
      payload,
      xSignature || '',
      xRequestId || '',
    );
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResultDto,
  })
  async handleStripe(
    @Body() payload: StripeWebhookEvent,
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ): Promise<WebhookResultDto> {
    const rawBody = JSON.stringify(req.body);
    return this.webhooksService.handleStripeWebhook(
      payload,
      signature || '',
      rawBody,
    );
  }
}
