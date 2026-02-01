import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { User } from 'src/modules/users/entities/user.entity';

interface RequestWithUser {
  user: User;
}

export const GetUser = createParamDecorator(
  (
    data: keyof User | undefined,
    ctx: ExecutionContext,
  ): User | User[keyof User] => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    if (!user)
      throw new InternalServerErrorException('User not found (request');

    return !data ? user : user[data];
  },
);
