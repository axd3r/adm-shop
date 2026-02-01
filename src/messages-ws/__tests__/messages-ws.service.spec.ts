import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagesWsService } from '../messages-ws.service';
import { User } from '../../modules/users/entities/user.entity';
import { Socket } from 'socket.io';

describe('MessagesWsService', () => {
  let service: MessagesWsService;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    isActive: true,
    roles: ['user'],
  } as User;

  const mockSocket = {
    id: 'socket-123',
    disconnect: jest.fn(),
  } as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesWsService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessagesWsService>(MessagesWsService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerClient', () => {
    it('should register a client successfully', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);

      await service.registerClient(mockSocket, 'user-123');

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-123' });
      expect(service.getConnectedClients()).toContain('socket-123');
    });

    it('should throw error if user not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.registerClient(mockSocket, 'nonexistent'),
      ).rejects.toThrow('User not found');
    });

    it('should throw error if user is not active', async () => {
      userRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as User);

      await expect(
        service.registerClient(mockSocket, 'user-123'),
      ).rejects.toThrow('User not active');
    });

    it('should disconnect previous session if user reconnects', async () => {
      const firstSocket = {
        id: 'socket-first',
        disconnect: jest.fn(),
      } as unknown as Socket;
      const secondSocket = {
        id: 'socket-second',
        disconnect: jest.fn(),
      } as unknown as Socket;

      userRepository.findOneBy.mockResolvedValue(mockUser);

      await service.registerClient(firstSocket, 'user-123');
      await service.registerClient(secondSocket, 'user-123');

      // The first socket should be disconnected
      expect(firstSocket.disconnect).toHaveBeenCalled();
      // The second socket should be connected
      expect(service.getConnectedClients()).toContain('socket-second');
    });
  });

  describe('removeClient', () => {
    it('should remove a client', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.removeClient('socket-123');

      expect(service.getConnectedClients()).not.toContain('socket-123');
    });

    it('should handle removing non-existent client', () => {
      expect(() => service.removeClient('nonexistent')).not.toThrow();
    });
  });

  describe('getConnectedClients', () => {
    it('should return empty array when no clients connected', () => {
      expect(service.getConnectedClients()).toEqual([]);
    });

    it('should return array of connected socket ids', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      const clients = service.getConnectedClients();

      expect(clients).toContain('socket-123');
    });
  });

  describe('getUserFullName', () => {
    it('should return user full name for connected client', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      const fullName = service.getUserFullName('socket-123');

      expect(fullName).toBe('Test User');
    });
  });
});
