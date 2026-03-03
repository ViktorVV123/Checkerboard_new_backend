import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FactoriesModule } from './factories/factories.module';
import { ProductsModule } from './products/products.module';
import { CalculationsModule } from './calculations/calculations.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ScenariosModule } from './scenarios/scenarios.module';

@Module({
  imports: [PrismaModule, FactoriesModule, ProductsModule, CalculationsModule, AuthModule, CommonModule, ScenariosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
