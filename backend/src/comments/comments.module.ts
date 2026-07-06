// -*- coding: utf-8 -*-

import { Module, OnModuleInit } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { Comment } from './entities/comment.entity';

import { Animal } from '../animals/entities/animal.entity';

import { CommentsController } from './comments.controller';

import { CommentsService } from './comments.service';

import { AiBridgeService } from './ai-bridge.service';



@Module({
  imports: [TypeOrmModule.forFeature([Comment, Animal])],
  controllers: [CommentsController],
  providers: [CommentsService, AiBridgeService],
  exports: [CommentsService],
})
export class CommentsModule implements OnModuleInit {
  constructor(private readonly ai: AiBridgeService) {}
  onModuleInit() { this.ai.init(); }
}
