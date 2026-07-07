// -*- coding: utf-8 -*-

import { Test, TestingModule } from '@nestjs/testing';

import { getRepositoryToken } from '@nestjs/typeorm';

import { Comment, CommentSentiment } from './entities/comment.entity';

import { Animal, AnimalStatus } from '../animals/entities/animal.entity';

import { CommentsService } from './comments.service';

import { AiBridgeService, ModerateResult } from './ai-bridge.service';
import { ClueBridgeService } from './clue-bridge.service';



function makeRepo() {
  return {
    create: jest.fn((dto: any) => dto),
    save: jest.fn(async (e: any) => e),
    findOne: jest.fn(),
    find: jest.fn(async () => []),
    findAndCount: jest.fn(async () => [[], 0]),
  };
}

function makeAnimal(over: Partial<Animal> = {}): Animal {
  return {
    animal_id: '550e8400-e29b-41d4-a716-446655440000',
    status: AnimalStatus.LOST,
    species: 'dog' as any,
    breed: 'x',
    color: 'x',
    gender: 'unknown' as any,
    age_estimate: 'adult' as any,
    health_status: 'healthy' as any,
    sterilized: false,
    first_seen_at: new Date(),
    last_seen_at: new Date(),
    location_lat: 0,
    location_lng: 0,
    address: null,
    notes: null,
    tags: null,
    primary_nose_id: null,
    photos: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  } as unknown as Animal;
}

function makeClueBridge(): Partial<ClueBridgeService> {
  return {
    init: jest.fn(),
    extractKeywords: jest.fn(() => []),
    matchComment: jest.fn(() => ({ status: 'no_match' })),
    listPending: jest.fn(() => ({})),
    decide: jest.fn(() => true),
    getStateDir: jest.fn(() => ''),
    getSegmenterKind: jest.fn(() => 'fallback'),
  } as any;
}
function makeAiBridge(): Partial<AiBridgeService> {
  return {
    moderate: jest.fn(async (content: string): Promise<ModerateResult> => ({
      verdict: 'allow',
      suggested_action: 'allow',
      reasons: [],
      primary_sentiment: CommentSentiment.NEUTRAL,
      is_hidden: false,
    })),
    summarize: jest.fn(async (id: string, items: any[]) => ({
      total: items.length,
      sentiment_dist: {},
      top_keywords: [],
      auto_summary: items.length + ' 条评论',
    })),
    init: jest.fn(),
  };
}

describe('CommentsService', () => {
  let mod: TestingModule;
  let svc: CommentsService;
  let commentsRepo: any;
  let animalRepo: any;
  let ai: any;
  let clue: any;

  beforeEach(async () => {
    commentsRepo = makeRepo();
    animalRepo = makeRepo();
    ai = makeAiBridge();
    clue = makeClueBridge();
    mod = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentsRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: AiBridgeService, useValue: ai },
        { provide: ClueBridgeService, useValue: clue },
      ],
    }).compile();
    svc = mod.get(CommentsService);
    svc._resetCache();
  });

  afterEach(async () => { await mod.close(); });

  describe('create()', () => {
    it('happy path: writes comment with ai.moderate verdict', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ status: AnimalStatus.LOST }));
      ai.moderate.mockResolvedValue({
        verdict: 'allow', suggested_action: 'allow', reasons: [],
        primary_sentiment: CommentSentiment.CARE, is_hidden: false,
      });
      commentsRepo.save.mockResolvedValue({ comment_id: 'c-new' });
      const r: any = await svc.create({ animal_id: '550e8400-e29b-41d4-a716-446655440000', content: '你好' } as any, 'u1');
      expect(ai.moderate).toHaveBeenCalledWith('你好', 'u1', 0);
      expect(commentsRepo.save).toHaveBeenCalled();
      expect(r).toBeTruthy();
    });

    it('rejects animal_id not UUID', async () => {
      await expect(svc.create({ animal_id: 'not-uuid', content: 'x' } as any, 'u1'))
        .rejects.toThrow();
    });

    it('rejects comment on claimed/archived animal (423 LOCKED)', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ status: AnimalStatus.CLAIMED }));
      await expect(svc.create({ animal_id: '550e8400-e29b-41d4-a716-446655440000', content: 'x' } as any, 'u1'))
        .rejects.toMatchObject({ status: 423 });
    });

    it('throws NotFound when animal missing', async () => {
      animalRepo.findOne.mockResolvedValue(null);
      await expect(svc.create({ animal_id: '550e8400-e29b-41d4-a716-446655440000', content: 'x' } as any, 'u1'))
        .rejects.toThrow();
    });

    it('60s dedup: same reporter + same content within 60s returns existing', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ status: AnimalStatus.LOST }));
      commentsRepo.save.mockResolvedValue({ comment_id: 'first' });
      const c1 = await svc.create({ animal_id: '550e8400-e29b-41d4-a716-446655440000', content: 'hi' } as any, 'u1');
      expect(commentsRepo.save).toHaveBeenCalledTimes(1);
      // 第二次:不调 save,直接返回 (缓存命中)
      commentsRepo.findOne.mockResolvedValue({ comment_id: 'first', content: 'hi' });
      const c2 = await svc.create({ animal_id: '550e8400-e29b-41d4-a716-446655440000', content: 'hi' } as any, 'u1');
      expect(c2.comment_id).toEqual(c1.comment_id);
      expect(commentsRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('summarize()', () => {
    it('calls ai.summarize with comment shapes (content + created_at only)', async () => {
      commentsRepo.find.mockResolvedValue([
        { content: '你好', created_at: new Date() },
        { content: '再见', created_at: new Date() },
      ]);
      await svc.summarize('550e8400-e29b-41d4-a716-446655440000');
      expect(ai.summarize).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', [
        { content: '你好', created_at: expect.any(Date) },
        { content: '再见', created_at: expect.any(Date) },
      ]);
    });
  });
});
