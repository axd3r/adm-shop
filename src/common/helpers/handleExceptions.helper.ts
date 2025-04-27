import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';

const logger = new Logger('DBHelper');

export const handleDBExceptions = (error: any): never => {
  if (error.code === '23505') {
    throw new BadRequestException(error.detail);
  }

  logger.error(error);
  throw new InternalServerErrorException('Unexpected error, check server logs');
};
