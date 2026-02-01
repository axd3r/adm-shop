import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from '../cart.controller';
import { CartService } from '../cart.service';
import { User } from '../../users/entities/user.entity';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';

describe('CartController', () => {
  let controller: CartController;
  let service: jest.Mocked<CartService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: ['user'],
  } as User;

  const mockCart = {
    id: 'cart-123',
    userId: 'user-123',
    subtotal: 100,
    itemCount: 2,
    items: [],
  } as unknown as Cart;

  const mockCartItem = {
    id: 'item-123',
    cartId: 'cart-123',
    productId: 'product-123',
    quantity: 2,
    price: 50,
    subtotal: 100,
  } as unknown as CartItem;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        {
          provide: CartService,
          useValue: {
            getCart: jest.fn(),
            addItem: jest.fn(),
            updateItem: jest.fn(),
            removeItem: jest.fn(),
            clearCart: jest.fn(),
            getCartForCheckout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
    service = module.get(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return user cart', async () => {
      service.getCart.mockResolvedValue(mockCart);

      const result = await controller.getCart(mockUser);

      expect(result).toEqual(mockCart);
      expect(service.getCart).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('addItem', () => {
    const addToCartDto = {
      productId: 'product-123',
      quantity: 2,
      size: 'M',
    };

    it('should add item to cart', async () => {
      const cartWithItem = { ...mockCart, items: [mockCartItem] };
      service.addItem.mockResolvedValue(cartWithItem);

      const result = await controller.addItem(addToCartDto, mockUser);

      expect(result).toEqual(cartWithItem);
      expect(service.addItem).toHaveBeenCalledWith(mockUser.id, addToCartDto);
    });
  });

  describe('updateItem', () => {
    const updateDto = { quantity: 5 };

    it('should update cart item', async () => {
      service.updateItem.mockResolvedValue(mockCart);

      const result = await controller.updateItem(
        'item-123',
        updateDto,
        mockUser,
      );

      expect(result).toEqual(mockCart);
      expect(service.updateItem).toHaveBeenCalledWith(
        mockUser.id,
        'item-123',
        updateDto,
      );
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      service.removeItem.mockResolvedValue(mockCart);

      const result = await controller.removeItem('item-123', mockUser);

      expect(result).toEqual(mockCart);
      expect(service.removeItem).toHaveBeenCalledWith(mockUser.id, 'item-123');
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      const emptyCart = { ...mockCart, items: [], subtotal: 0, itemCount: 0 };
      service.clearCart.mockResolvedValue(emptyCart);

      const result = await controller.clearCart(mockUser);

      expect(result).toEqual(emptyCart);
      expect(service.clearCart).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getCheckoutSummary', () => {
    it('should return checkout summary', async () => {
      const checkoutSummary = {
        items: [mockCartItem],
        subtotal: 100,
        tax: 18,
        shippingCost: 0,
        total: 118,
      };
      service.getCartForCheckout.mockResolvedValue(checkoutSummary);

      const result = await controller.getCheckoutSummary(mockUser);

      expect(result).toEqual(checkoutSummary);
      expect(service.getCartForCheckout).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
