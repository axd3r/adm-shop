import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { User } from '../../modules/users/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: ['user'],
  } as unknown as User;

  const mockLoginResponse = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
    },
    token: 'mock_jwt_token',
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            loginUser: jest.fn(),
            checkAuthStatus: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Test123!',
    };

    it('should login user and return token', async () => {
      service.loginUser.mockResolvedValue(mockLoginResponse);

      const result = await controller.loginUser(loginDto);

      expect(result).toEqual(mockLoginResponse);
      expect(service.loginUser).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('findUserInfo (private route)', () => {
    it('should return user info for authenticated user', () => {
      const mockRequest = {} as any;
      const mockHeader = ['Bearer token'];

      const result = controller.findUserInfo(
        mockRequest,
        mockUser,
        mockUser.email,
        mockHeader,
      );

      expect(result).toEqual({
        ok: true,
        user: mockUser,
        userEmail: mockUser.email,
        header: mockHeader,
      });
    });
  });

  describe('anotherFindUserInfo (private2 route with roles)', () => {
    it('should return user info for admin/superUser', () => {
      const mockRequest = {} as any;
      const mockHeader = ['Bearer token'];

      const result = controller.anotherFindUserInfo(
        mockRequest,
        mockUser,
        mockUser.email,
        mockHeader,
      );

      expect(result).toEqual({
        ok: true,
        user: mockUser,
        userEmail: mockUser.email,
        header: mockHeader,
      });
    });
  });

  describe('anotherFindUserInf (private3 route - admin only)', () => {
    it('should return user info for admin', () => {
      const result = controller.anotherFindUserInf(mockUser);

      expect(result).toEqual({
        ok: true,
        user: mockUser,
      });
    });
  });

  describe('checkAuthStatus', () => {
    it('should return user with new token', () => {
      const mockResponse = {
        ...mockUser,
        token: 'new_mock_jwt_token',
      };
      service.checkAuthStatus.mockReturnValue(mockResponse);

      const result = controller.checkAuthStatus(mockUser);

      expect(result).toEqual(mockResponse);
      expect(service.checkAuthStatus).toHaveBeenCalledWith(mockUser);
    });
  });
});
