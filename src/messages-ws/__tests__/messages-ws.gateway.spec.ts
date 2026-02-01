import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MessagesWsGateway } from '../messages-ws.gateway';
import { MessagesWsService } from '../messages-ws.service';
import { Socket, Server } from 'socket.io';

describe('MessagesWsGateway', () => {
  let gateway: MessagesWsGateway;
  let messagesWsService: jest.Mocked<MessagesWsService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockSocket = {
    id: 'socket-123',
    handshake: {
      headers: {
        authentication: 'valid-token',
      },
    },
    disconnect: jest.fn(),
  } as unknown as Socket;

  const mockServer = {
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesWsGateway,
        {
          provide: MessagesWsService,
          useValue: {
            registerClient: jest.fn(),
            removeClient: jest.fn(),
            getConnectedClients: jest.fn().mockReturnValue(['socket-123']),
            getUserFullName: jest.fn().mockReturnValue('Test User'),
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

    gateway = module.get<MessagesWsGateway>(MessagesWsGateway);
    messagesWsService = module.get(MessagesWsService);
    jwtService = module.get(JwtService);

    // Set the server manually
    gateway.wss = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should register client on valid token', async () => {
      jwtService.verify.mockReturnValue({ id: 'user-123' });
      messagesWsService.registerClient.mockResolvedValue(undefined);

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(messagesWsService.registerClient).toHaveBeenCalledWith(
        mockSocket,
        'user-123',
      );
      expect(mockServer.emit).toHaveBeenCalledWith('clients-updated', [
        'socket-123',
      ]);
    });

    it('should disconnect client on invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(messagesWsService.registerClient).not.toHaveBeenCalled();
    });

    it('should disconnect if no token provided', async () => {
      const socketWithoutToken = {
        ...mockSocket,
        handshake: { headers: {} },
        disconnect: jest.fn(),
      } as unknown as Socket;

      jwtService.verify.mockImplementation(() => {
        throw new Error('No token');
      });

      await gateway.handleConnection(socketWithoutToken);

      expect(socketWithoutToken.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client and emit updated list', () => {
      gateway.handleDisconnect(mockSocket);

      expect(messagesWsService.removeClient).toHaveBeenCalledWith('socket-123');
      expect(mockServer.emit).toHaveBeenCalledWith('clients-updated', [
        'socket-123',
      ]);
    });
  });

  describe('handleMessageFromClient', () => {
    it('should broadcast message to all clients', () => {
      const payload = { message: 'Hello World' };

      gateway.handleMessageFromClient(mockSocket, payload);

      expect(mockServer.emit).toHaveBeenCalledWith('message-from-server', {
        fullName: 'Test User',
        message: 'Hello World',
      });
    });

    it('should use default message if none provided', () => {
      const payload = {} as any;

      gateway.handleMessageFromClient(mockSocket, payload);

      expect(mockServer.emit).toHaveBeenCalledWith('message-from-server', {
        fullName: 'Test User',
        message: 'no-message!!',
      });
    });
  });
});
