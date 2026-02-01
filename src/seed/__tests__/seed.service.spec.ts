import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeedService } from '../seed.service';
import { ProductsService } from '../../modules/products/products.service';
import { User } from '../../modules/users/entities/user.entity';

describe('SeedService', () => {
  let service: SeedService;
  let productsService: jest.Mocked<ProductsService>;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: 'user-123',
    email: 'admin@test.com',
    fullName: 'Admin User',
    roles: ['admin'],
  } as User;

  const mockQueryBuilder = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        {
          provide: ProductsService,
          useValue: {
            deleteAllProducts: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            create: jest.fn().mockImplementation((user) => user),
            save: jest.fn().mockResolvedValue([mockUser]),
          },
        },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
    productsService = module.get(ProductsService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSeed', () => {
    it('should execute seed and return success message', async () => {
      productsService.deleteAllProducts.mockResolvedValue(undefined);
      productsService.create.mockResolvedValue({} as any);

      const result = await service.executeSeed();

      expect(result).toBe('SEED EXECUTED');
    });

    it('should delete existing products before seeding', async () => {
      productsService.deleteAllProducts.mockResolvedValue(undefined);
      productsService.create.mockResolvedValue({} as any);

      await service.executeSeed();

      expect(productsService.deleteAllProducts).toHaveBeenCalled();
    });

    it('should delete existing users before seeding', async () => {
      productsService.deleteAllProducts.mockResolvedValue(undefined);
      productsService.create.mockResolvedValue({} as any);

      await service.executeSeed();

      expect(userRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should insert new users', async () => {
      productsService.deleteAllProducts.mockResolvedValue(undefined);
      productsService.create.mockResolvedValue({} as any);

      await service.executeSeed();

      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should insert new products with admin user', async () => {
      productsService.deleteAllProducts.mockResolvedValue(undefined);
      productsService.create.mockResolvedValue({} as any);

      await service.executeSeed();

      expect(productsService.create).toHaveBeenCalled();
    });
  });
});
