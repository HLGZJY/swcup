import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NoseController } from './nose.controller';
import { NoseService } from './nose.service';
import { NoseFeature } from './entities/nose-feature.entity';
import { PendingNoseRecord } from './entities/pending-nose-record.entity';
import { Animal } from '../animals/entities/animal.entity';
import { RescueEvent } from '../events/entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NoseFeature, Animal, RescueEvent, PendingNoseRecord])],
  controllers: [NoseController],
  providers: [NoseService],
  exports: [NoseService],
})
export class NoseModule {}