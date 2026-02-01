import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Socket, Server } from 'socket.io';
import { User } from 'src/modules/users/entities/user.entity';
import {
  PushNotification,
  NotificationType,
  NotificationPriority,
  PaymentNotificationData,
} from '../interfaces/push-notification.interface';

interface ConnectedClient {
  socket: Socket;
  user: User;
  connectedAt: Date;
}

interface ConnectedClients {
  [socketId: string]: ConnectedClient;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private connectedClients: ConnectedClients = {};
  private server: Server;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  async registerClient(socket: Socket, userId: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User not active');
    }

    // Disconnect previous connection if exists
    this.disconnectPreviousSession(userId);

    this.connectedClients[socket.id] = {
      socket,
      user,
      connectedAt: new Date(),
    };

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Join user to role-based rooms
    for (const role of user.roles) {
      socket.join(`role:${role}`);
    }

    this.logger.log(`Client registered: ${user.email} (${socket.id})`);
  }

  removeClient(socketId: string): void {
    const client = this.connectedClients[socketId];
    if (client) {
      this.logger.log(`Client disconnected: ${client.user.email}`);
      delete this.connectedClients[socketId];
    }
  }

  getConnectedClients(): string[] {
    return Object.keys(this.connectedClients);
  }

  getConnectedUsers(): Array<{ id: string; email: string; fullName: string }> {
    return Object.values(this.connectedClients).map((client) => ({
      id: client.user.id,
      email: client.user.email,
      fullName: client.user.fullName,
    }));
  }

  isUserConnected(userId: string): boolean {
    return Object.values(this.connectedClients).some(
      (client) => client.user.id === userId,
    );
  }

  private disconnectPreviousSession(userId: string): void {
    for (const [socketId, client] of Object.entries(this.connectedClients)) {
      if (client.user.id === userId) {
        client.socket.emit('notification', this.createNotification({
          type: NotificationType.SYSTEM,
          title: 'Sesión cerrada',
          message: 'Se inició sesión en otro dispositivo',
          priority: NotificationPriority.NORMAL,
        }));
        client.socket.disconnect();
        delete this.connectedClients[socketId];
        break;
      }
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  private createNotification(params: {
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    data?: Record<string, unknown>;
  }): PushNotification {
    return {
      id: this.generateNotificationId(),
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority || NotificationPriority.NORMAL,
      data: params.data,
      timestamp: new Date(),
      read: false,
    };
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Send notification to a specific user
  sendToUser(userId: string, notification: PushNotification): boolean {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return false;
    }

    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.log(`Notification sent to user ${userId}: ${notification.type}`);
    return true;
  }

  // Send notification to all users with a specific role
  sendToRole(role: string, notification: PushNotification): void {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }

    this.server.to(`role:${role}`).emit('notification', notification);
    this.logger.log(`Notification sent to role ${role}: ${notification.type}`);
  }

  // Send notification to all connected users
  broadcast(notification: PushNotification): void {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }

    this.server.emit('notification', notification);
    this.logger.log(`Broadcast notification: ${notification.type}`);
  }

  // ==================== PAYMENT NOTIFICATIONS ====================

  notifyPaymentSuccess(userId: string, data: PaymentNotificationData): void {
    const notification = this.createNotification({
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Pago exitoso',
      message: `Tu pago de ${data.currency} ${data.amount.toFixed(2)} ha sido procesado correctamente`,
      priority: NotificationPriority.HIGH,
      data,
    });

    this.sendToUser(userId, notification);

    // Also notify admins
    this.sendToRole('admin', this.createNotification({
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Nuevo pago recibido',
      message: `Orden ${data.orderNumber} - ${data.currency} ${data.amount.toFixed(2)}`,
      priority: NotificationPriority.NORMAL,
      data,
    }));
  }

  notifyPaymentFailed(userId: string, data: PaymentNotificationData): void {
    const notification = this.createNotification({
      type: NotificationType.PAYMENT_FAILED,
      title: 'Pago fallido',
      message: data.errorMessage || 'No se pudo procesar tu pago. Por favor, intenta de nuevo.',
      priority: NotificationPriority.HIGH,
      data,
    });

    this.sendToUser(userId, notification);
  }

  notifyPaymentRefunded(userId: string, data: PaymentNotificationData): void {
    const notification = this.createNotification({
      type: NotificationType.PAYMENT_REFUNDED,
      title: 'Reembolso procesado',
      message: `Se ha reembolsado ${data.currency} ${data.amount.toFixed(2)} a tu método de pago`,
      priority: NotificationPriority.HIGH,
      data,
    });

    this.sendToUser(userId, notification);
  }

  notifyPaymentPending(userId: string, data: PaymentNotificationData): void {
    const notification = this.createNotification({
      type: NotificationType.PAYMENT_PENDING,
      title: 'Pago pendiente',
      message: `Tu pago está siendo procesado. Te notificaremos cuando se complete.`,
      priority: NotificationPriority.NORMAL,
      data,
    });

    this.sendToUser(userId, notification);
  }

  // ==================== ORDER NOTIFICATIONS ====================

  notifyOrderCreated(userId: string, orderNumber: string, total: number, currency: string): void {
    const notification = this.createNotification({
      type: NotificationType.ORDER_CREATED,
      title: 'Orden creada',
      message: `Tu orden ${orderNumber} por ${currency} ${total.toFixed(2)} ha sido creada`,
      priority: NotificationPriority.NORMAL,
      data: { orderNumber, total, currency },
    });

    this.sendToUser(userId, notification);
  }

  notifyOrderShipped(userId: string, orderNumber: string, trackingNumber?: string): void {
    const notification = this.createNotification({
      type: NotificationType.ORDER_SHIPPED,
      title: 'Orden enviada',
      message: trackingNumber
        ? `Tu orden ${orderNumber} ha sido enviada. Tracking: ${trackingNumber}`
        : `Tu orden ${orderNumber} ha sido enviada`,
      priority: NotificationPriority.HIGH,
      data: { orderNumber, trackingNumber },
    });

    this.sendToUser(userId, notification);
  }

  notifyOrderDelivered(userId: string, orderNumber: string): void {
    const notification = this.createNotification({
      type: NotificationType.ORDER_DELIVERED,
      title: 'Orden entregada',
      message: `Tu orden ${orderNumber} ha sido entregada`,
      priority: NotificationPriority.HIGH,
      data: { orderNumber },
    });

    this.sendToUser(userId, notification);
  }
}
