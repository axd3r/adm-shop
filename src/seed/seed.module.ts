import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { ProductsModule } from 'src/modules/products/products.module';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  controllers: [SeedController],
  providers: [SeedService],
  imports: [ProductsModule, AuthModule, UsersModule],
})
export class SeedModule {}
