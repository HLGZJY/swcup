// -*- coding: utf-8 -*-

import { Module, OnModuleInit } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { Comment } from './entities/comment.entity';

import { Animal } from '../animals/entities/animal.entity';
import { RescueEvent } from '../events/entities/event.entity';

import { CommentsController } from './comments.controller';

import { CommentsService } from './comments.service';

import { AiBridgeService } from './ai-bridge.service';
import { ClueBridgeService } from './clue-bridge.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Animal, RescueEvent])],
  controllers: [CommentsController],
  providers: [CommentsService, AiBridgeService, ClueBridgeService],
  exports: [CommentsService, ClueBridgeService],
})
export class CommentsModule implements OnModuleInit {
  constructor(private readonly ai: AiBridgeService, private readonly clue: ClueBridgeService) {}
  onModuleInit() { this.ai.init(); this.clue.init(); }
}