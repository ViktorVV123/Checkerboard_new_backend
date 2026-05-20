import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { json, urlencoded } from 'express';

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Поднимаем лимит тела запроса с дефолтных 100kb.
  // Нужно для /import/commit — JSON с правками из Excel может весить 200kb–5mb
  // (за месяц ~1700 правок ≈ 200kb, за квартал может быть больше).
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

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

  await app.listen(3000);

}
bootstrap();
