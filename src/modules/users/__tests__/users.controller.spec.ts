import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: ['user'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      email: 'test@example.com',
      password: 'Test123!',
      fullName: 'Test User',
    };

    it('should create a user', async () => {
      service.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('findAll', () => {
    it('should return all users', () => {
      service.findAll.mockReturnValue('This action returns all users');

      const result = controller.findAll();

      expect(result).toBe('This action returns all users');
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', () => {
      service.findOne.mockReturnValue('This action returns a #1 user');

      const result = controller.findOne('1');

      expect(result).toBe('This action returns a #1 user');
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should update a user', () => {
      service.update.mockReturnValue('This action updates a #1 user');

      const result = controller.update('1', { fullName: 'Updated Name' });

      expect(result).toBe('This action updates a #1 user');
      expect(service.update).toHaveBeenCalledWith(1, {
        fullName: 'Updated Name',
      });
    });
  });

  describe('remove', () => {
    it('should remove a user', () => {
      service.remove.mockReturnValue('This action removes a #1 user');

      const result = controller.remove('1');

      expect(result).toBe('This action removes a #1 user');
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
