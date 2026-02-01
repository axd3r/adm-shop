import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { User } from '../../modules/users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  compareSync: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashed_password',
    isActive: true,
    roles: ['user'],
  } as unknown as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_jwt_token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Test123!',
    };

    it('should login user successfully and return token', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);

      const result = await service.loginUser(loginDto);

      expect(result).toHaveProperty('token', 'mock_jwt_token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should call repository with correct email and select fields', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);

      await service.loginUser(loginDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        select: { email: true, password: true, id: true, fullName: true },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.loginUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginUser(loginDto)).rejects.toThrow(
        'Credentials are not valid (email)',
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);

      await expect(service.loginUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginUser(loginDto)).rejects.toThrow(
        'Credentials are not valid (password)',
      );
    });

    it('should generate JWT with user id', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);

      await service.loginUser(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith({ id: mockUser.id });
    });
  });

  describe('checkAuthStatus', () => {
    it('should return user with new token', () => {
      const result = service.checkAuthStatus(mockUser);

      expect(result).toHaveProperty('token', 'mock_jwt_token');
      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
    });

    it('should generate new JWT token', () => {
      service.checkAuthStatus(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith({ id: mockUser.id });
    });
  });

  describe('findOne', () => {
    it('should return message for findOne', () => {
      const result = service.findOne(1);
      expect(result).toBe('This action returns a #1 auth');
    });
  });
});
