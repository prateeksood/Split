import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
})
export class SettlementsModule {}
