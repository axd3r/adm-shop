import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Injectable()
export class SellerOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: User;
      params: { id?: string };
    }>();
    const user = request.user;
    const productId = request.params.id;

    // Admin and superUser can access any resource
    if (
      user.roles.includes(ValidRoles.admin) ||
      user.roles.includes(ValidRoles.superUser)
    ) {
      return true;
    }

    // If no product ID in params, allow (for create operations)
    if (!productId) {
      return true;
    }

    // For sellers, check ownership
    if (user.roles.includes(ValidRoles.seller)) {
      const product = await this.productRepository.findOne({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Check if the seller owns this product
      if (product.sellerId !== user.id && product.user?.id !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to modify this product',
        );
      }

      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
