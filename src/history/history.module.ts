import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FactoriesModule } from '../factories/factories.module';

@Module({
  imports: [PrismaModule, FactoriesModule],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
