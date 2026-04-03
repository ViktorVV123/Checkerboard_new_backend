import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Factory Portal API')
    .setDescription('API для управления данными заводов')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'access-id',
        in: 'header',
        description: 'Access Token (IdM или DEV)',
      },
      'access-id',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ 'access-id': [] }];
  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.listen(3002);

}
bootstrap();
