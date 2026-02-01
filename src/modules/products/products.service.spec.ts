import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { User } from '../users/entities/user.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: jest.Mocked<Repository<Product>>;
  let productImageRepository: jest.Mocked<Repository<ProductImage>>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashed',
    isActive: true,
    roles: ['user'],
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
    images: [],
    user: mockUser,
    checkSlugInsert: jest.fn(),
    checkSlugUpdate: jest.fn(),
  } as unknown as Product;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  } as unknown as jest.Mocked<SelectQueryBuilder<Product>>;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      delete: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            preload: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(ProductImage),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepository = module.get(getRepositoryToken(Product));
    productImageRepository = module.get(getRepositoryToken(ProductImage));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const createDto = {
        title: 'New Product',
        price: 49.99,
        description: 'A new product',
        slug: 'new-product',
        stock: 5,
        sizes: ['S', 'M'],
        gender: 'male' as const,
        images: ['http://example.com/img1.jpg'],
      };

      productRepository.create.mockReturnValue(mockProduct);
      productRepository.save.mockResolvedValue(mockProduct);
      productImageRepository.create.mockReturnValue({
        url: 'http://example.com/img1.jpg',
      } as ProductImage);

      const result = await service.create(createDto, mockUser);

      expect(productRepository.create).toHaveBeenCalled();
      expect(productRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('images');
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const productsWithImages = [
        { ...mockProduct, images: [{ url: 'img1.jpg' } as ProductImage] },
        { ...mockProduct, id: 'product-456', images: [] },
      ] as unknown as Product[];
      productRepository.find.mockResolvedValue(productsWithImages);

      const result = await service.findAll({ limit: 10, offset: 0 });

      expect(productRepository.find).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        relations: { images: true },
      });
      expect(result).toHaveLength(2);
    });

    it('should use default pagination values', async () => {
      productRepository.find.mockResolvedValue([]);

      await service.findAll({});

      expect(productRepository.find).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        relations: { images: true },
      });
    });
  });

  describe('findOne', () => {
    it('should find a product by UUID', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      productRepository.findOneBy.mockResolvedValue(mockProduct);

      const result = await service.findOne(uuid);

      expect(productRepository.findOneBy).toHaveBeenCalledWith({ id: uuid });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if UUID not found', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      productRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(uuid)).rejects.toThrow(NotFoundException);
    });

    it('should find a product by slug', async () => {
      (mockQueryBuilder.getOne as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.findOne('test-product');

      expect(productRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if slug not found', async () => {
      (mockQueryBuilder.getOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOnePlain', () => {
    it('should return product with image URLs', async () => {
      const productWithImages = {
        ...mockProduct,
        images: [
          { url: 'img1.jpg' } as ProductImage,
          { url: 'img2.jpg' } as ProductImage,
        ],
      } as unknown as Product;
      productRepository.findOneBy.mockResolvedValue(productWithImages);

      const result = await service.findOnePlain(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result.images).toEqual(['img1.jpg', 'img2.jpg']);
    });
  });

  describe('update', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    const productWithUUID = { ...mockProduct, id: validUUID } as unknown as Product;

    it('should update a product', async () => {
      const updateDto = { title: 'Updated Title' };
      productRepository.preload.mockResolvedValue(productWithUUID);
      productRepository.findOneBy.mockResolvedValue(productWithUUID);

      const result = await service.update(validUUID, updateDto, mockUser);

      expect(productRepository.preload).toHaveBeenCalledWith({
        id: validUUID,
        ...updateDto,
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.preload.mockResolvedValue(undefined);

      await expect(
        service.update('non-existent', { title: 'Test' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update product images', async () => {
      const updateDto = { images: ['new-img.jpg'] };
      productRepository.preload.mockResolvedValue(productWithUUID);
      productImageRepository.create.mockReturnValue({
        url: 'new-img.jpg',
      } as ProductImage);
      productRepository.findOneBy.mockResolvedValue(productWithUUID);

      await service.update(validUUID, updateDto, mockUser);

      expect(mockQueryRunner.manager.delete).toHaveBeenCalled();
      expect(productImageRepository.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      productRepository.findOneBy.mockResolvedValue(mockProduct);
      productRepository.remove.mockResolvedValue(mockProduct);

      const result = await service.remove(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(productRepository.remove).toHaveBeenCalledWith(mockProduct);
      expect(result.status).toBe('Success');
    });
  });

  describe('deleteAllProducts', () => {
    it('should delete all products', async () => {
      (mockQueryBuilder.execute as jest.Mock).mockResolvedValue({ affected: 5 });

      await service.deleteAllProducts();

      expect(productRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });
});
