import { Test, TestingModule } from '@nestjs/testing';
import { SeedController } from '../seed.controller';
import { SeedService } from '../seed.service';

describe('SeedController', () => {
  let controller: SeedController;
  let service: jest.Mocked<SeedService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeedController],
      providers: [
        {
          provide: SeedService,
          useValue: {
            executeSeed: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SeedController>(SeedController);
    service = module.get(SeedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSeed', () => {
    it('should execute seed and return success message', async () => {
      service.executeSeed.mockResolvedValue('SEED EXECUTED');

      const result = await controller.executeSeed();

      expect(result).toBe('SEED EXECUTED');
      expect(service.executeSeed).toHaveBeenCalled();
    });

    it('should call seed service', async () => {
      service.executeSeed.mockResolvedValue('SEED EXECUTED');

      await controller.executeSeed();

      expect(service.executeSeed).toHaveBeenCalledTimes(1);
    });
  });
});
