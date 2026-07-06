import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnimalsController } from './animals.controller';
import { AnimalsService } from './animals.service';
import { Animal } from './entities/animal.entity';
import { NoseFeature } from '../nose/entities/nose-feature.entity';
import { RescueEvent } from '../events/entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Animal, NoseFeature, RescueEvent])],
  controllers: [AnimalsController],
  providers: [AnimalsService],
  exports: [AnimalsService],
})
export class AnimalsModule {}