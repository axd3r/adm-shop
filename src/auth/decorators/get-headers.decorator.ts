import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

export const GetHeaders = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const headers = req.headers;

    if (!headers)
      throw new InternalServerErrorException('header is not found (request');

    return !data ? headers : headers[data];
  },
);
