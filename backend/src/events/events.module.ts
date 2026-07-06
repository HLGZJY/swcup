import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RescueEvent } from './entities/event.entity';
import { Animal } from '../animals/entities/animal.entity';
import { NoseModule } from '../nose/nose.module';
import { MatchingModule } from '../matching/matching.module';
import { AnimalsModule } from '../animals/animals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RescueEvent, Animal]),
    NoseModule,
    MatchingModule,
    // 阶段 1 (2026-07-06): 引入 AnimalsModule 用于 EventsService 自动建档 (intent='lost'/'found')
    AnimalsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}