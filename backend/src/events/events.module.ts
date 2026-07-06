import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RescueEvent } from './entities/event.entity';
import { Animal } from '../animals/entities/animal.entity';
import { NoseModule } from '../nose/nose.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [TypeOrmModule.forFeature([RescueEvent, Animal]), NoseModule, MatchingModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}