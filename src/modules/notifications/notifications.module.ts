import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { EmailService } from './services/email.service';
import { PushService } from './services/push.service';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { User } from '../users/entities/user.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '2h' },
      }),
    }),
  ],
  providers: [EmailService, PushService, NotificationsGateway],
  exports: [EmailService, PushService],
})
export class NotificationsModule {}
