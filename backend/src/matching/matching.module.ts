import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Animal } from '../animals/entities/animal.entity';
import { MatchingService } from './matching.service';

@Module({
  imports: [TypeOrmModule.forFeature([Animal])],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
