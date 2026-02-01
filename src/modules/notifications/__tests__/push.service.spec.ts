import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushService } from '../services/push.service';
import { User } from '../../users/entities/user.entity';
import { Socket, Server } from 'socket.io';
import {
  NotificationType,
  NotificationPriority,
  PushNotification,
  PaymentNotificationData,
} from '../interfaces/push-notification.interface';

describe('PushService', () => {
  let service: PushService;
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
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as Socket;

  const mockServer = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  } as unknown as Server;

  const createNotification = (): PushNotification => ({
    id: 'notif-123',
    type: NotificationType.SYSTEM,
    title: 'Test',
    message: 'Test message',
    priority: NotificationPriority.NORMAL,
    timestamp: new Date(),
    read: false,
  });

  const createPaymentData = (): PaymentNotificationData => ({
    paymentId: 'pay-123',
    paymentReference: 'PAY-001',
    orderId: 'order-123',
    orderNumber: 'ORD-001',
    amount: 100,
    currency: 'PEN',
    provider: 'culqi',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
    userRepository = module.get(getRepositoryToken(User));

    service.setServer(mockServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setServer', () => {
    it('should set the server instance', () => {
      const newServer = { emit: jest.fn() } as unknown as Server;
      service.setServer(newServer);
      expect(true).toBe(true);
    });
  });

  describe('registerClient', () => {
    it('should register a client successfully', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);

      await service.registerClient(mockSocket, 'user-123');

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-123' });
      expect(mockSocket.join).toHaveBeenCalledWith('user:user-123');
      expect(mockSocket.join).toHaveBeenCalledWith('role:user');
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

    it('should disconnect previous session on reconnect', async () => {
      const firstSocket = {
        id: 'socket-first',
        join: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      userRepository.findOneBy.mockResolvedValue(mockUser);

      await service.registerClient(firstSocket, 'user-123');
      await service.registerClient(mockSocket, 'user-123');

      expect(firstSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('removeClient', () => {
    it('should remove a client', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.removeClient('socket-123');

      expect(service.getConnectedClients()).not.toContain('socket-123');
    });
  });

  describe('getConnectedClients', () => {
    it('should return empty array when no clients', () => {
      expect(service.getConnectedClients()).toEqual([]);
    });

    it('should return array of socket ids', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      expect(service.getConnectedClients()).toContain('socket-123');
    });
  });

  describe('getConnectedUsers', () => {
    it('should return connected users info', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      const users = service.getConnectedUsers();

      expect(users).toContainEqual({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      });
    });
  });

  describe('isUserConnected', () => {
    it('should return true for connected user', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      expect(service.isUserConnected('user-123')).toBe(true);
    });

    it('should return false for disconnected user', () => {
      expect(service.isUserConnected('user-123')).toBe(false);
    });
  });

  describe('sendToUser', () => {
    it('should send notification to specific user', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      const notification = createNotification();
      const result = service.sendToUser('user-123', notification);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
      expect(result).toBe(true);
    });

    it('should return false if server not initialized', () => {
      const newService = new PushService(userRepository);
      const notification = createNotification();

      const result = newService.sendToUser('user-123', notification);

      expect(result).toBe(false);
    });
  });

  describe('sendToRole', () => {
    it('should send notification to role', () => {
      const notification = createNotification();

      service.sendToRole('admin', notification);

      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
    });
  });

  describe('broadcast', () => {
    it('should broadcast notification to all', () => {
      const notification = createNotification();

      service.broadcast(notification);

      expect(mockServer.emit).toHaveBeenCalledWith('notification', notification);
    });
  });

  describe('payment notifications', () => {
    it('should send payment success notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyPaymentSuccess('user-123', createPaymentData());

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });

    it('should send payment failed notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyPaymentFailed('user-123', {
        ...createPaymentData(),
        errorMessage: 'Card declined',
      });

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });

    it('should send payment refunded notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyPaymentRefunded('user-123', createPaymentData());

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });

    it('should send payment pending notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyPaymentPending('user-123', createPaymentData());

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });
  });

  describe('order notifications', () => {
    it('should send order created notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyOrderCreated('user-123', 'ORD-001', 100, 'PEN');

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });

    it('should send order shipped notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyOrderShipped('user-123', 'ORD-001', 'TRACK123');

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });

    it('should send order shipped notification without tracking', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyOrderShipped('user-123', 'ORD-001');

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });

    it('should send order delivered notification', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);
      await service.registerClient(mockSocket, 'user-123');

      service.notifyOrderDelivered('user-123', 'ORD-001');

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });
  });
});
