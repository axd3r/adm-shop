import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailOptions,
  EmailTemplate,
  PaymentEmailContext,
} from '../interfaces/email-options.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly companyName: string;
  private readonly supportEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || '';
    this.fromName =
      this.configService.get<string>('SMTP_FROM_NAME') || 'ADM Shop';
    this.companyName =
      this.configService.get<string>('COMPANY_NAME') || 'ADM Shop';
    this.supportEmail =
      this.configService.get<string>('SUPPORT_EMAIL') || this.fromEmail;

    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not configured. Email notifications will be disabled.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(`SMTP connection failed: ${error.message}`);
      } else {
        this.logger.log('SMTP connection established successfully');
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email not sent: SMTP not configured');
      return false;
    }

    try {
      const html = this.renderTemplate(options.template, options.context);

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error}`);
      return false;
    }
  }

  async sendPaymentSuccessEmail(context: PaymentEmailContext): Promise<boolean> {
    return this.sendEmail({
      to: context.customerEmail,
      subject: `Pago confirmado - Orden ${context.orderNumber}`,
      template: EmailTemplate.PAYMENT_SUCCESS,
      context: {
        ...context,
        companyName: this.companyName,
        supportEmail: this.supportEmail,
      },
    });
  }

  async sendPaymentFailedEmail(
    context: PaymentEmailContext & { errorMessage: string },
  ): Promise<boolean> {
    return this.sendEmail({
      to: context.customerEmail,
      subject: `Problema con tu pago - Orden ${context.orderNumber}`,
      template: EmailTemplate.PAYMENT_FAILED,
      context: {
        ...context,
        companyName: this.companyName,
        supportEmail: this.supportEmail,
      },
    });
  }

  async sendPaymentRefundedEmail(context: PaymentEmailContext): Promise<boolean> {
    return this.sendEmail({
      to: context.customerEmail,
      subject: `Reembolso procesado - Orden ${context.orderNumber}`,
      template: EmailTemplate.PAYMENT_REFUNDED,
      context: {
        ...context,
        companyName: this.companyName,
        supportEmail: this.supportEmail,
      },
    });
  }

  private renderTemplate(
    template: EmailTemplate,
    context: Record<string, unknown>,
  ): string {
    switch (template) {
      case EmailTemplate.PAYMENT_SUCCESS:
        return this.renderPaymentSuccessTemplate(context as unknown as PaymentEmailContext);
      case EmailTemplate.PAYMENT_FAILED:
        return this.renderPaymentFailedTemplate(
          context as unknown as PaymentEmailContext & { errorMessage: string },
        );
      case EmailTemplate.PAYMENT_REFUNDED:
        return this.renderPaymentRefundedTemplate(context as unknown as PaymentEmailContext);
      default:
        return '';
    }
  }

  private renderPaymentSuccessTemplate(context: PaymentEmailContext): string {
    const itemsHtml = context.items
      ? context.items
          .map(
            (item) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${context.currency} ${item.price.toFixed(2)}</td>
          </tr>
        `,
          )
          .join('')
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago Confirmado</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Pago Confirmado</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Gracias por tu compra</p>
            </td>
          </tr>

          <!-- Success Icon -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #4CAF50; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 40px; line-height: 80px;">&#10003;</span>
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 30px;">
              <p style="font-size: 16px; color: #333;">Hola <strong>${context.customerName}</strong>,</p>
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Tu pago ha sido procesado exitosamente. A continuación encontrarás los detalles de tu transacción.
              </p>
            </td>
          </tr>

          <!-- Payment Details -->
          <tr>
            <td style="padding: 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 10px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Orden:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #333;">${context.orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Referencia de pago:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #333;">${context.paymentReference}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Fecha:</td>
                        <td style="padding: 8px 0; text-align: right; color: #333;">${context.paidAt}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Método de pago:</td>
                        <td style="padding: 8px 0; text-align: right; color: #333;">${context.cardBrand || ''} ${context.cardMask || context.paymentMethod}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Items -->
          ${
            context.items
              ? `
          <tr>
            <td style="padding: 0 30px 20px;">
              <h3 style="color: #333; margin-bottom: 15px;">Detalle de la orden</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 8px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; color: #666;">Producto</th>
                    <th style="padding: 12px; text-align: center; color: #666;">Cant.</th>
                    <th style="padding: 12px; text-align: right; color: #666;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Total -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #667eea; border-radius: 8px; color: white;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${context.subtotal ? `<tr><td style="padding: 5px 0;">Subtotal:</td><td style="text-align: right;">${context.currency} ${context.subtotal.toFixed(2)}</td></tr>` : ''}
                      ${context.shipping ? `<tr><td style="padding: 5px 0;">Envío:</td><td style="text-align: right;">${context.currency} ${context.shipping.toFixed(2)}</td></tr>` : ''}
                      <tr>
                        <td style="padding: 10px 0 0 0; font-size: 20px; font-weight: bold;">Total pagado:</td>
                        <td style="padding: 10px 0 0 0; text-align: right; font-size: 24px; font-weight: bold;">${context.currency} ${context.total.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
                Si tienes alguna pregunta, contáctanos en <a href="mailto:${context.supportEmail}" style="color: #667eea;">${context.supportEmail}</a>
              </p>
              <p style="color: #999; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} ${context.companyName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private renderPaymentFailedTemplate(
    context: PaymentEmailContext & { errorMessage: string },
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Problema con tu pago</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e53935 0%, #d32f2f 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Problema con tu pago</h1>
            </td>
          </tr>

          <!-- Warning Icon -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #ff9800; border-radius: 50%; margin: 0 auto;">
                <span style="color: white; font-size: 50px; line-height: 80px;">!</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <p style="font-size: 16px; color: #333;">Hola <strong>${context.customerName}</strong>,</p>
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Lamentamos informarte que no pudimos procesar tu pago para la orden <strong>${context.orderNumber}</strong>.
              </p>

              <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #e65100;"><strong>Motivo:</strong> ${context.errorMessage}</p>
              </div>

              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Por favor, intenta nuevamente con otro método de pago o contacta a tu banco para más información.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
                ¿Necesitas ayuda? Contáctanos en <a href="mailto:${context.supportEmail}" style="color: #667eea;">${context.supportEmail}</a>
              </p>
              <p style="color: #999; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} ${context.companyName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private renderPaymentRefundedTemplate(context: PaymentEmailContext): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reembolso Procesado</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00897b 0%, #00695c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Reembolso Procesado</h1>
            </td>
          </tr>

          <!-- Icon -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #00897b; border-radius: 50%; margin: 0 auto;">
                <span style="color: white; font-size: 40px; line-height: 80px;">&#8634;</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <p style="font-size: 16px; color: #333;">Hola <strong>${context.customerName}</strong>,</p>
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Te confirmamos que hemos procesado el reembolso de tu orden <strong>${context.orderNumber}</strong>.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e0f2f1; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #00695c;">Monto reembolsado:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 20px; color: #00695c;">${context.currency} ${context.total.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Referencia:</td>
                        <td style="padding: 8px 0; text-align: right; color: #333;">${context.paymentReference}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #666; line-height: 1.6;">
                El reembolso puede tardar entre 5-10 días hábiles en reflejarse en tu estado de cuenta, dependiendo de tu banco.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
                ¿Tienes preguntas? Contáctanos en <a href="mailto:${context.supportEmail}" style="color: #667eea;">${context.supportEmail}</a>
              </p>
              <p style="color: #999; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} ${context.companyName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}
