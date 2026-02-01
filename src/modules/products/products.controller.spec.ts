import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { User } from '../users/entities/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { SellerOwnershipGuard } from '../../auth/guards/seller-ownership/seller-ownership.guard';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: jest.Mocked<ProductsService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'admin@example.com',
    fullName: 'Admin User',
    password: 'hashed',
    isActive: true,
    roles: ['admin'],
  } as User;

  const mockProduct = {
    id: 'product-123',
    title: 'Test Product',
    price: 99.99,
    description: 'A test product',
    slug: 'test-product',
    stock: 10,
    sizes: ['M', 'L'],
    gender: 'unisex',
    tags: ['test'],
    images: ['img1.jpg'],
    user: mockUser,
    sellerId: 'user-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findBySeller: jest.fn(),
            findOnePlain: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SellerOwnershipGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createDto: CreateProductDto = {
        title: 'New Product',
        price: 49.99,
        description: 'A new product',
        slug: 'new-product',
        stock: 5,
        sizes: ['S', 'M'],
        gender: 'male',
      };

      const createdProduct = { ...mockProduct, ...createDto };
      productsService.create.mockResolvedValue(createdProduct);

      const result = await controller.create(createDto, mockUser);

      expect(productsService.create).toHaveBeenCalledWith(createDto, mockUser);
      expect(result).toEqual(createdProduct);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const products = [mockProduct, { ...mockProduct, id: 'product-456' }];
      productsService.findAll.mockResolvedValue(products as any);

      const result = await controller.findAll(paginationDto);

      expect(productsService.findAll).toHaveBeenCalledWith(paginationDto);
      expect(result).toEqual(products);
    });
  });

  describe('findOne', () => {
    it('should return a product by term (slug or id)', async () => {
      const productPlain = { ...mockProduct, images: ['img1.jpg'] };
      productsService.findOnePlain.mockResolvedValue(productPlain as any);

      const result = await controller.findOne('test-product');

      expect(productsService.findOnePlain).toHaveBeenCalledWith('test-product');
      expect(result).toEqual(productPlain);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const updateDto: UpdateProductDto = { title: 'Updated Title' };
      const updatedProduct = { ...mockProduct, ...updateDto };
      productsService.update.mockResolvedValue(updatedProduct as any);

      const result = await controller.update(mockProduct.id, updateDto, mockUser);

      expect(productsService.update).toHaveBeenCalledWith(
        mockProduct.id,
        updateDto,
        mockUser,
      );
      expect(result).toEqual(updatedProduct);
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      const deleteResponse = { status: 'Success', message: 'Registro eliminado con exito' };
      productsService.remove.mockResolvedValue(deleteResponse);

      const result = await controller.remove(mockProduct.id, mockUser);

      expect(productsService.remove).toHaveBeenCalledWith(mockProduct.id, mockUser);
      expect(result).toEqual(deleteResponse);
    });
  });

  describe('findMySeller', () => {
    it('should return products owned by seller', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const products = [mockProduct];
      productsService.findBySeller.mockResolvedValue(products as any);

      const result = await controller.findMySeller(paginationDto, mockUser);

      expect(productsService.findBySeller).toHaveBeenCalledWith(paginationDto, mockUser);
      expect(result).toEqual(products);
    });
  });
});
