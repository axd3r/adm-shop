import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Cart } from './entities/cart.entity';
import { Auth } from 'src/auth/decorators/auth/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({
    status: 200,
    description: 'User cart',
    type: Cart,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  @Auth()
  getCart(@GetUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart',
    type: Cart,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Post('items')
  @Auth()
  addItem(@Body() addToCartDto: AddToCartDto, @GetUser() user: User) {
    return this.cartService.addItem(user.id, addToCartDto);
  }

  @ApiOperation({ summary: 'Update cart item' })
  @ApiResponse({
    status: 200,
    description: 'Cart item updated',
    type: Cart,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @Patch('items/:id')
  @Auth()
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
    @GetUser() user: User,
  ) {
    return this.cartService.updateItem(user.id, id, updateCartItemDto);
  }

  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({
    status: 200,
    description: 'Item removed from cart',
    type: Cart,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @Delete('items/:id')
  @Auth()
  removeItem(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.cartService.removeItem(user.id, id);
  }

  @ApiOperation({ summary: 'Clear all items from cart' })
  @ApiResponse({
    status: 200,
    description: 'Cart cleared',
    type: Cart,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Delete()
  @Auth()
  clearCart(@GetUser() user: User) {
    return this.cartService.clearCart(user.id);
  }

  @ApiOperation({ summary: 'Get cart summary for checkout' })
  @ApiResponse({
    status: 200,
    description: 'Cart checkout summary with totals',
  })
  @ApiResponse({ status: 400, description: 'Cart is empty' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('checkout')
  @Auth()
  getCheckoutSummary(@GetUser() user: User) {
    return this.cartService.getCartForCheckout(user.id);
  }
}
