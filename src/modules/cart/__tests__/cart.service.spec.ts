import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from '../cart.service';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { Product } from '../../products/entities/product.entity';

describe('CartService', () => {
  let service: CartService;
  let cartRepository: jest.Mocked<Repository<Cart>>;
  let cartItemRepository: jest.Mocked<Repository<CartItem>>;
  let productRepository: jest.Mocked<Repository<Product>>;

  const mockProduct = {
    id: 'product-123',
    title: 'Test Product',
    price: 50.0,
    stock: 10,
    slug: 'test-product',
    images: [],
  } as unknown as Product;

  const mockCart = {
    id: 'cart-123',
    userId: 'user-123',
    subtotal: 0,
    itemCount: 0,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Cart;

  const mockCartItem = {
    id: 'item-123',
    cartId: 'cart-123',
    productId: 'product-123',
    product: mockProduct,
    quantity: 2,
    price: 50.0,
    subtotal: 100.0,
    size: 'M',
  } as unknown as CartItem;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: getRepositoryToken(Cart),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CartItem),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    cartRepository = module.get(getRepositoryToken(Cart));
    cartItemRepository = module.get(getRepositoryToken(CartItem));
    productRepository = module.get(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return existing cart for user', async () => {
      cartRepository.findOne.mockResolvedValue(mockCart);

      const result = await service.getCart('user-123');

      expect(result).toEqual(mockCart);
      expect(cartRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        relations: ['items', 'items.product', 'items.product.images'],
      });
    });

    it('should create new cart if user has no cart', async () => {
      cartRepository.findOne.mockResolvedValue(null);
      const newCart = { ...mockCart, items: [] };
      cartRepository.create.mockReturnValue(newCart);
      cartRepository.save.mockResolvedValue(newCart);

      const result = await service.getCart('user-123');

      expect(cartRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        subtotal: 0,
        itemCount: 0,
      });
      expect(cartRepository.save).toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });
  });

  describe('addItem', () => {
    const addToCartDto = {
      productId: 'product-123',
      quantity: 2,
      size: 'M',
    };

    it('should add new item to cart', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue(null);
      cartItemRepository.create.mockReturnValue(mockCartItem);
      cartItemRepository.save.mockResolvedValue(mockCartItem);
      cartItemRepository.find.mockResolvedValue([mockCartItem]);

      const cartWithItem = { ...mockCart, items: [mockCartItem] };
      cartRepository.findOne
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce(cartWithItem);

      const result = await service.addItem('user-123', addToCartDto);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-123' },
      });
      expect(cartItemRepository.create).toHaveBeenCalled();
      expect(cartItemRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.addItem('user-123', addToCartDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      productRepository.findOne.mockResolvedValue({
        ...mockProduct,
        stock: 1,
      } as any);

      await expect(service.addItem('user-123', addToCartDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update quantity if item already in cart', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue(mockCartItem);
      cartItemRepository.save.mockResolvedValue({
        ...mockCartItem,
        quantity: 4,
      });
      cartItemRepository.find.mockResolvedValue([mockCartItem]);

      await service.addItem('user-123', addToCartDto);

      expect(cartItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 4 }),
      );
    });
  });

  describe('updateItem', () => {
    const updateDto = { quantity: 5 };

    it('should update cart item quantity', async () => {
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue({
        ...mockCartItem,
        product: mockProduct,
      });
      cartItemRepository.save.mockResolvedValue({
        ...mockCartItem,
        quantity: 5,
      });
      cartItemRepository.find.mockResolvedValue([mockCartItem]);

      await service.updateItem('user-123', 'item-123', updateDto);

      expect(cartItemRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if item not found', async () => {
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateItem('user-123', 'item-123', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue({
        ...mockCartItem,
        product: { ...mockProduct, stock: 2 },
      } as any);

      await expect(
        service.updateItem('user-123', 'item-123', { quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue(mockCartItem);
      cartItemRepository.remove.mockResolvedValue(mockCartItem);
      cartItemRepository.find.mockResolvedValue([]);

      await service.removeItem('user-123', 'item-123');

      expect(cartItemRepository.remove).toHaveBeenCalledWith(mockCartItem);
    });

    it('should throw NotFoundException if item not found', async () => {
      cartRepository.findOne.mockResolvedValue(mockCart);
      cartItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeItem('user-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      cartRepository.findOne.mockResolvedValue({
        ...mockCart,
        items: [mockCartItem],
      });
      cartItemRepository.delete.mockResolvedValue({ affected: 1, raw: [] });
      cartRepository.save.mockResolvedValue({ ...mockCart, items: [] });

      const result = await service.clearCart('user-123');

      expect(cartItemRepository.delete).toHaveBeenCalledWith({
        cartId: mockCart.id,
      });
      expect(cartRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ subtotal: 0, itemCount: 0 }),
      );
    });
  });

  describe('getCartForCheckout', () => {
    it('should return cart summary with totals', async () => {
      const cartWithItems = {
        ...mockCart,
        subtotal: 100,
        items: [mockCartItem],
      };
      cartRepository.findOne.mockResolvedValue(cartWithItems);

      const result = await service.getCartForCheckout('user-123');

      expect(result).toHaveProperty('subtotal', 100);
      expect(result).toHaveProperty('tax');
      expect(result).toHaveProperty('shippingCost');
      expect(result).toHaveProperty('total');
    });

    it('should throw BadRequestException if cart is empty', async () => {
      cartRepository.findOne.mockResolvedValue({ ...mockCart, items: [] });

      await expect(service.getCartForCheckout('user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should have free shipping for orders over 100', async () => {
      const cartWithItems = {
        ...mockCart,
        subtotal: 150,
        items: [mockCartItem],
      };
      cartRepository.findOne.mockResolvedValue(cartWithItems);

      const result = await service.getCartForCheckout('user-123');

      expect(result.shippingCost).toBe(0);
    });

    it('should charge shipping for orders under 100', async () => {
      const cartWithItems = {
        ...mockCart,
        subtotal: 50,
        items: [mockCartItem],
      };
      cartRepository.findOne.mockResolvedValue(cartWithItems);

      const result = await service.getCartForCheckout('user-123');

      expect(result.shippingCost).toBe(10);
    });
  });
});
