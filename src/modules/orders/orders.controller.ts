import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './entities/order.entity';
import { Auth } from 'src/auth/decorators/auth/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: Order,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  @Auth()
  create(@Body() createOrderDto: CreateOrderDto, @GetUser() user: User) {
    return this.ordersService.create(createOrderDto, user);
  }

  @ApiOperation({ summary: 'Get all orders for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of user orders',
    type: [Order],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  @Auth()
  findAll(@GetUser() user: User) {
    return this.ordersService.findAll(user.id);
  }

  @ApiOperation({ summary: 'Get all orders (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of all orders',
    type: [Order],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @Get('admin/all')
  @Auth(ValidRoles.admin)
  findAllAdmin() {
    return this.ordersService.findAllAdmin();
  }

  @ApiOperation({ summary: 'Get orders containing seller products' })
  @ApiResponse({
    status: 200,
    description: 'List of orders with seller products',
    type: [Order],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Seller only' })
  @Get('seller/my-orders')
  @Auth(ValidRoles.seller, ValidRoles.admin)
  findSellerOrders(@GetUser() user: User) {
    return this.ordersService.findForSeller(user.id);
  }

  @ApiOperation({ summary: 'Get a specific order by ID' })
  @ApiResponse({
    status: 200,
    description: 'Order found',
    type: Order,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.ordersService.findOne(id, user.id);
  }

  @ApiOperation({ summary: 'Update order status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated',
    type: Order,
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @Patch(':id/status')
  @Auth(ValidRoles.admin)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled',
    type: Order,
  })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch(':id/cancel')
  @Auth()
  cancel(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.ordersService.cancel(id, user.id);
  }
}
