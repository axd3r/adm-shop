import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PushService } from '../services/push.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfcae';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly pushService: PushService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server): void {
    this.pushService.setServer(server);
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      await this.pushService.registerClient(client, payload.id);

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to notifications',
        timestamp: new Date(),
      });

      // Emit updated client list to admins
      this.server.to('role:admin').emit('clients-updated', {
        connectedUsers: this.pushService.getConnectedUsers(),
        totalConnections: this.pushService.getConnectedClients().length,
      });
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.pushService.removeClient(client.id);

    // Emit updated client list to admins
    this.server.to('role:admin').emit('clients-updated', {
      connectedUsers: this.pushService.getConnectedUsers(),
      totalConnections: this.pushService.getConnectedClients().length,
    });
  }

  @SubscribeMessage('mark-read')
  handleMarkRead(client: Socket, payload: { notificationId: string }): void {
    // Acknowledge that notification was read
    client.emit('notification-read', {
      notificationId: payload.notificationId,
      readAt: new Date(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): void {
    client.emit('pong', { timestamp: new Date() });
  }

  private extractToken(client: Socket): string | null {
    // Try to get token from different sources
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const authToken = client.handshake.headers.authentication as string;
    if (authToken) {
      return authToken;
    }

    const queryToken = client.handshake.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }
}
