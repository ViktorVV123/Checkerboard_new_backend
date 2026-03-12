import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);

    switch (exception.code) {
      case 'P2002':
        // Уникальное ограничение нарушено
        response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'Запись с такими данными уже существует',
          error: 'Conflict',
        });
        break;

      case 'P2025':
        // Запись не найдена
        response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Запись не найдена',
          error: 'Not Found',
        });
        break;

      case 'P2003':
        // Нарушение внешнего ключа
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Связанная запись не найдена',
          error: 'Bad Request',
        });
        break;

      default:
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Ошибка базы данных',
          error: 'Internal Server Error',
        });
    }
  }
}
