import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { PushService } from '../services/push.service';
import { Socket, Server } from 'socket.io';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let pushService: jest.Mocked<PushService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockServer = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  } as unknown as Server;

  const createMockSocket = (overrides = {}): Socket =>
    ({
      id: 'socket-123',
      handshake: {
        headers: {
          authorization: 'Bearer valid-token',
        },
        query: {},
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    }) as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: PushService,
          useValue: {
            setServer: jest.fn(),
            registerClient: jest.fn(),
            removeClient: jest.fn(),
            getConnectedUsers: jest.fn().mockReturnValue([]),
            getConnectedClients: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    pushService = module.get(PushService);
    jwtService = module.get(JwtService);

    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('afterInit', () => {
    it('should set server on push service', () => {
      gateway.afterInit(mockServer);

      expect(pushService.setServer).toHaveBeenCalledWith(mockServer);
    });
  });

  describe('handleConnection', () => {
    it('should register client with Bearer token', async () => {
      const mockSocket = createMockSocket();
      jwtService.verify.mockReturnValue({ id: 'user-123' });

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(pushService.registerClient).toHaveBeenCalledWith(
        mockSocket,
        'user-123',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Connected to notifications',
        timestamp: expect.any(Date),
      });
    });

    it('should accept authentication header token', async () => {
      const mockSocket = createMockSocket({
        handshake: {
          headers: { authentication: 'auth-token' },
          query: {},
        },
      });
      jwtService.verify.mockReturnValue({ id: 'user-123' });

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('auth-token');
    });

    it('should accept query token', async () => {
      const mockSocket = createMockSocket({
        handshake: {
          headers: {},
          query: { token: 'query-token' },
        },
      });
      jwtService.verify.mockReturnValue({ id: 'user-123' });

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('query-token');
    });

    it('should disconnect if no token provided', async () => {
      const mockSocket = createMockSocket({
        handshake: { headers: {}, query: {} },
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required',
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should disconnect on invalid token', async () => {
      const mockSocket = createMockSocket();
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication failed',
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client and emit updated list', () => {
      const mockSocket = createMockSocket();

      gateway.handleDisconnect(mockSocket);

      expect(pushService.removeClient).toHaveBeenCalledWith('socket-123');
      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
    });
  });

  describe('handleMarkRead', () => {
    it('should emit notification-read event', () => {
      const mockSocket = createMockSocket();
      const payload = { notificationId: 'notif-123' };

      gateway.handleMarkRead(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('notification-read', {
        notificationId: 'notif-123',
        readAt: expect.any(Date),
      });
    });
  });

  describe('handlePing', () => {
    it('should respond with pong', () => {
      const mockSocket = createMockSocket();

      gateway.handlePing(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('pong', {
        timestamp: expect.any(Date),
      });
    });
  });
});
