import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RescueEvent } from './entities/event.entity';
import { NoseModule } from '../nose/nose.module';

@Module({
  imports: [TypeOrmModule.forFeature([RescueEvent]), NoseModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}