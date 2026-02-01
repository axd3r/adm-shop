import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { Payment } from './entities/payment.entity';
import { Auth } from 'src/auth/decorators/auth/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'Process payment for an order' })
  @ApiResponse({
    status: 201,
    description: 'Payment processed successfully',
    type: Payment,
  })
  @ApiResponse({ status: 400, description: 'Payment failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Post()
  @Auth()
  createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @GetUser() user: User,
  ) {
    return this.paymentsService.createPayment(createPaymentDto, user);
  }

  @ApiOperation({ summary: 'Get all payments for current user' })
  @ApiResponse({
    status: 200,
    description: 'List of user payments',
    type: [Payment],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  @Auth()
  findAll(@GetUser() user: User) {
    return this.paymentsService.findAll(user.id);
  }

  @ApiOperation({ summary: 'Get all payments (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of all payments',
    type: [Payment],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @Get('admin/all')
  @Auth(ValidRoles.admin)
  findAllAdmin() {
    return this.paymentsService.findAll();
  }

  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    type: Payment,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Get payments for an order' })
  @ApiResponse({
    status: 200,
    description: 'List of payments for order',
    type: [Payment],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('order/:orderId')
  @Auth()
  findByOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.findByOrder(orderId);
  }

  @ApiOperation({ summary: 'Refund a payment (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Payment refunded',
    type: Payment,
  })
  @ApiResponse({ status: 400, description: 'Refund failed' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @Post(':id/refund')
  @Auth(ValidRoles.admin)
  refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() refundPaymentDto: RefundPaymentDto,
  ) {
    return this.paymentsService.refundPayment(id, refundPaymentDto);
  }
}
