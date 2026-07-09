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
import { DictionaryLoader } from './dictionary.loader';
import { TextNormalizer } from './text-normalizer';
import { FileStateStore } from './file-state-store';
import { EventRecallService } from './event-recall.service';
import { ClueStatsService } from './clue-stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Animal, RescueEvent])],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    AiBridgeService,
    ClueBridgeService,
    DictionaryLoader,
    TextNormalizer,
    FileStateStore,
    EventRecallService,
    ClueStatsService,
  ],
  exports: [
    CommentsService,
    ClueBridgeService,
    DictionaryLoader,
    TextNormalizer,
    FileStateStore,
    EventRecallService,
    ClueStatsService,
  ],
})
export class CommentsModule implements OnModuleInit {
  constructor(
    private readonly ai: AiBridgeService,
    private readonly clue: ClueBridgeService,
    private readonly dict: DictionaryLoader,
  ) {}
  onModuleInit() {
    // DictionaryLoader 自己有 onModuleInit, 这里仅调其他需要 cfg 初始化的 service
    this.ai.init();
    this.clue.init();
    void this.dict; // 已由 Nest 在 module 实例化时自动调 onModuleInit
  }
}