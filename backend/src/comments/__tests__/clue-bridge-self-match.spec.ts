// -*- coding: utf-8 -*-
/**
 * 【2026-07-14 阶段 E bug收尾】ClueBridgeService self_match 落盘测试
 *
 * 现场: 用户在自己的 animal 底下发"我在 xx 路看到"等 REPORT 评论,
 *       recall.recall 返回的事件全是 self 报的 → bestEvent.reporter_id == reporterId
 *       → 旧实现 status='self_match' + state_path='' 不落盘 → admin 永远看不到
 *
 * 修复: self_match 也落盘, 保留 bestScore / candidate_event_id, admin 可看
 *       状态名保持 'self_match' (admin 端 UI 可标识低优先级)
 *
 * 覆盖:
 *   1) 全 self 候选 → status='self_match' + 落盘 + score > 0 + candidate_event_id 非空
 *   2) 全 self 候选 → FileStateStore.appendSync 被调 1 次
 *   3) 混合 (有 self + 非 self) → 选非 self 作 best (旧行为, 不落盘 pending 也会被落盘)
 *   4) listPending / _listPendingSync 同时显示 pending + self_match
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClueBridgeService } from '../clue-bridge.service';
import { DictionaryLoader } from '../dictionary.loader';
import { FileStateStore } from '../file-state-store';
import { Comment } from '../entities/comment.entity';
import { Animal } from '../../animals/entities/animal.entity';
import { RescueEvent } from '../../events/entities/event.entity';

describe('ClueBridgeService self_match 落盘 (2026-07-14 阶段 E)', () => {
  let svc: ClueBridgeService;
  let tmpState: string;
  let commentRepo: any;
  let animalRepo: any;
  let eventRepo: any;

  const ANIMAL_ID = 'a-self-match';
  const COMMENT_ID = 'c-self-1';
  const REPORTER_ID = 'u-self'; // 既是评论人, 也是事件 reporter

  beforeEach(async () => {
    tmpState = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_selfmatch_'));
    commentRepo = {
      update: jest.fn(),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
    };
    animalRepo = {
      update: jest.fn(),
      findOne: jest.fn(async () => ({
        animal_id: ANIMAL_ID,
        location_lat: 39.92,
        location_lng: 116.46,
        address: '北京市朝阳区',
      })),
      save: jest.fn(),
    };
    eventRepo = {
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
    };

    const tmpDicts = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_dicts_self_'));
    const cfg: Partial<ConfigService> = {
      get: jest.fn((key: string) => {
        if (key === 'CLUE_STATE_DIR') return tmpState;
        if (key === 'CLUE_DICTS_DIR') return tmpDicts;
        return undefined as any;
      }),
    };
    const dict = new DictionaryLoader(cfg as ConfigService);
    const store = new FileStateStore(cfg as ConfigService);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ClueBridgeService,
        { provide: ConfigService, useValue: cfg },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: DictionaryLoader, useValue: dict },
        { provide: FileStateStore, useValue: store },
      ],
    }).compile();
    svc = mod.get(ClueBridgeService);
    svc.init();
  });

  afterEach(() => {
    if (fs.existsSync(tmpState)) {
      fs.rmSync(tmpState, { recursive: true, force: true });
    }
  });

  it('全 self 候选: status=self_match, score>0, candidate_event_id 非空, 落盘 1 条', () => {
    // 召回: 全是 self 报的事件 (用户评论自己创建的 animal)
    const events = [
      {
        event_id: 'e-self-1',
        event_type: 'report',
        reporter_id: REPORTER_ID, // SELF
        occurred_at: '2026-07-14T10:00:00Z',
        address: '北京朝阳区金毛走失',
        event_lat: 39.92,
        event_lng: 116.46,
        animal_lat: 39.92,
        animal_lng: 116.46,
        source: 'same' as const,
      },
    ];
    const out = svc.matchComment(
      {
        comment_id: COMMENT_ID,
        animal_id: ANIMAL_ID,
        content: '我在朝阳公园看到金毛',
        reporter_id: REPORTER_ID,
        sentiment: 'report',
        created_at: '2026-07-14T10:00:00Z',
      },
      events,
    );

    // 旧: status=self_match, match_score=0, candidate_event_id='', 不落盘
    // 新: status=self_match, match_score>0, candidate_event_id=e-self-1, 落盘 1 条
    expect(out.status).toBe('self_match');
    expect(out.candidate_event_id).toBe('e-self-1');
    expect(out.match_score).toBeGreaterThan(0); // 含 sentiment=0.5 + entity + time_decay - 0.3 self 惩罚
    expect(out.match_id).toBeTruthy();
    expect(out.match_reasons.some((r) => r.startsWith('self_match'))).toBe(true);

    // 验证落盘: tmpState/<animal_id>.json 应有 1 条
    const stateFile = path.join(tmpState, ANIMAL_ID + '.json');
    expect(fs.existsSync(stateFile)).toBe(true);
    const list = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('self_match');
    expect(list[0].match_id).toBe(out.match_id);
    expect(list[0].candidate_event_id).toBe('e-self-1');
  });

  it('全 self 候选: listPending 能看到 self_match (admin 审核可见)', () => {
    const events = [
      {
        event_id: 'e-self-2',
        event_type: 'report',
        reporter_id: REPORTER_ID,
        occurred_at: '2026-07-14T10:00:00Z',
        address: '北京朝阳区金毛走失',
        event_lat: 39.92,
        event_lng: 116.46,
        animal_lat: 39.92,
        animal_lng: 116.46,
        source: 'same' as const,
      },
    ];
    svc.matchComment(
      {
        comment_id: COMMENT_ID,
        animal_id: ANIMAL_ID,
        content: '我在朝阳公园看到金毛',
        reporter_id: REPORTER_ID,
        sentiment: 'report',
        created_at: '2026-07-14T10:00:00Z',
      },
      events,
    );

    // _listPendingSync 应该返回 self_match 记录
    const pending = (svc as any)._listPendingSync();
    expect(pending[ANIMAL_ID]).toBeDefined();
    expect(pending[ANIMAL_ID]).toHaveLength(1);
    expect(pending[ANIMAL_ID][0].status).toBe('self_match');
  });

  it('非 self 候选: 旧行为保留, 落盘 status=pending', () => {
    // 召回: 其他用户报的事件 (非 self)
    const events = [
      {
        event_id: 'e-other-1',
        event_type: 'report',
        reporter_id: 'u-other', // 不是 self
        occurred_at: '2026-07-14T09:00:00Z',
        address: '北京朝阳区金毛走失',
        event_lat: 39.92,
        event_lng: 116.46,
        animal_lat: 39.92,
        animal_lng: 116.46,
        source: 'same' as const,
      },
    ];
    const out = svc.matchComment(
      {
        comment_id: COMMENT_ID,
        animal_id: ANIMAL_ID,
        content: '我在朝阳公园看到金毛',
        reporter_id: REPORTER_ID,
        sentiment: 'report',
        created_at: '2026-07-14T10:00:00Z',
      },
      events,
    );

    expect(out.status).toBe('pending');
    expect(out.candidate_event_id).toBe('e-other-1');
    expect(out.match_score).toBeGreaterThan(0);

    const stateFile = path.join(tmpState, ANIMAL_ID + '.json');
    expect(fs.existsSync(stateFile)).toBe(true);
    const list = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(list[0].status).toBe('pending');
  });

  it('混合候选 (self + other): best 选非 self (如果它 score 更高)', () => {
    const events = [
      {
        event_id: 'e-self-mix',
        event_type: 'report',
        reporter_id: REPORTER_ID, // SELF
        occurred_at: '2026-07-14T08:00:00Z',
        address: '北京',
        event_lat: 39.92,
        event_lng: 116.46,
        animal_lat: 39.92,
        animal_lng: 116.46,
        source: 'same' as const,
      },
      {
        event_id: 'e-other-mix',
        event_type: 'report',
        reporter_id: 'u-other-mix', // 不是 self, address 完全命中
        occurred_at: '2026-07-14T10:00:00Z',
        address: '北京朝阳公园金毛走失', // 高度匹配
        event_lat: 39.92,
        event_lng: 116.46,
        animal_lat: 39.92,
        animal_lng: 116.46,
        source: 'same' as const,
      },
    ];
    const out = svc.matchComment(
      {
        comment_id: COMMENT_ID,
        animal_id: ANIMAL_ID,
        content: '我在朝阳公园看到金毛',
        reporter_id: REPORTER_ID,
        sentiment: 'report',
        created_at: '2026-07-14T10:00:00Z',
      },
      events,
    );

    // 非 self 候选 score 应该 >= self 候选 (因为 -0.3 惩罚), 选它
    expect(out.status).toBe('pending');
    expect(out.candidate_event_id).toBe('e-other-mix');
  });
});
