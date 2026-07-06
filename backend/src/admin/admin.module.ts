import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RescueEvent } from '../events/entities/event.entity';
import { Claim } from '../claims/entities/claim.entity';
import { Animal } from '../animals/entities/animal.entity';
import { User } from '../users/entities/user.entity';
import { EventsModule } from '../events/events.module';
import { ClaimsModule } from '../claims/claims.module';
import { AnimalsModule } from '../animals/animals.module';
import { UsersModule } from '../users/users.module';
import { NoseModule } from '../nose/nose.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RescueEvent, Claim, Animal, User]),
    EventsModule,
    ClaimsModule,
    AnimalsModule,
    UsersModule,
    NoseModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}