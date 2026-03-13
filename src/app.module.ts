import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FactoriesModule } from './factories/factories.module';
import { ProductsModule } from './products/products.module';
import { CalculationsModule } from './calculations/calculations.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { AuthGuard } from './auth/guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    FactoriesModule,
    ProductsModule,
    CalculationsModule,
    AuthModule,
    CommonModule,
    ScenariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
