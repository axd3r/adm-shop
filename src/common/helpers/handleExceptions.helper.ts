import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

const logger = new Logger('DBHelper');

interface DBError {
  code?: string;
  detail?: string;
}

export const handleDBExceptions = (error: DBError): never => {
  if (error.code === '23505') {
    throw new BadRequestException(error.detail);
  }

  logger.error(error);
  throw new InternalServerErrorException('Unexpected error, check server logs');
};
