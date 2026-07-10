// -*- coding: utf-8 -*-
/**
 * 【2026-07-10 阶段 E P0】ClueBridgeService 地理硬过滤测试
 *
 * 覆盖:
 *   1) 同 animal (source='same') event 距 5km → 进入评分
 *   2) 同 animal (source='same') event 距 15km → 被硬过滤跳过
 *   3) 跨 animal 兜底 (source='fallback') event 距 200km → 保留软衰减
 *   4) animal 无坐标 → 跳过硬过滤, 正常评分
 *   5) geoHardFilterKm=0 (关闭) → 全过, 不硬切
 *   6) 边界值 9.9999km 进入 / 10.0001km 跳过
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClueBridgeService } from '../clue-bridge.service';
import { Comment } from '../entities/comment.entity';
import { Animal } from '../../animals/entities/animal.entity';
import { RescueEvent } from '../../events/entities/event.entity';
import { DictionaryLoader } from '../dictionary.loader';

describe('ClueBridgeService 地理硬过滤 (阶段 E P0)', () => {
  let svc: ClueBridgeService;
  let tmpState: string;
  let tmpDicts: string;

  beforeAll(async () => {
    tmpState = fs.mkdtempSync(path.join(os.tmpdir(), 'geo_hf_state_'));
    tmpDicts = fs.mkdtempSync(path.join(os.tmpdir(), 'geo_hf_dicts_'));
    const cfg: Partial<ConfigService> = {
      get: jest.fn((key: string) => {
        if (key === 'CLUE_STATE_DIR') return tmpState;
        if (key === 'CLUE_DICTS_DIR') return tmpDicts;
        return undefined as any;
      }),
    };
    const emptyRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(async () => ({ affected: 1 })),
      create: jest.fn((dto: any) => dto),
    };
    const dict = new DictionaryLoader(cfg as ConfigService);
    const { FileStateStore } = require('../file-state-store');
    const store = new FileStateStore(cfg as ConfigService);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ClueBridgeService,
        { provide: ConfigService, useValue: cfg },
        { provide: getRepositoryToken(Comment), useValue: emptyRepo },
        { provide: getRepositoryToken(Animal), useValue: emptyRepo },
        { provide: getRepositoryToken(RescueEvent), useValue: emptyRepo },
        { provide: DictionaryLoader, useValue: dict },
        { provide: FileStateStore, useValue: store },
      ],
    }).compile();
    svc = mod.get(ClueBridgeService);
    svc.init();
  });

  // 动物坐标 = 武汉 (30.5, 114.3)
  // helper: 在武汉 + N km 处生成事件 (lat/lng)
  // 沿纬度方向偏移, Haversine 反算: dist = R * dLat (dLng=0)
  //   dLat_rad = km / R, dLat_deg = dLat_rad * 180/π
  function wuhanOffsetEvent(km: number, overrides: any = {}): any {
    const dLatDeg = (km / 6371) * (180 / Math.PI);
    return {
      event_id: 'e-wuhan',
      event_type: 'report',
      reporter_id: 'u_owner',
      occurred_at: '2026-07-10T08:00:00Z',
      address: '武汉某地',
      description: '金毛走失',
      event_lat: 30.5 + dLatDeg,
      event_lng: 114.3,
      animal_lat: 30.5,
      animal_lng: 114.3,
      source: 'same',
      ...overrides,
    };
  }

  const baseComment = {
    comment_id: 'c-hf',
    animal_id: 'a-hf',
    content: '我刚在武汉看到一只金毛',
    reporter_id: 'u_x',
    sentiment: 'report',
    created_at: '2026-07-10T10:00:00Z',
  };

  it('同 animal 5km 事件 → 进入评分 (默认 hardFilterKm=10)', () => {
    const events = [wuhanOffsetEvent(5)];
    const r = svc.matchComment(baseComment, events);
    // 期望: 进入评分, status 应为 pending 或 no_match (取决于其他维度)
    // 关键: 不被硬过滤掉, 所以 reasons 中不应有 "geo_hard_filter" 痕迹
    // status 至少不是 no_match with 0 score (因为 sentiment+entity 应该 > 0)
    expect(r.match_score).toBeGreaterThan(0);
  });

  it('同 animal 15km 事件 → 被硬过滤跳过 (no_match)', () => {
    const events = [wuhanOffsetEvent(15)];
    const r = svc.matchComment(baseComment, events);
    // 15km > 10km hard filter, 跳过, bestEvent 为空
    expect(r.status).toBe('no_match');
    expect(r.candidate_event_id).toBe('');
  });

  it('同 animal 200km 事件 → 硬过滤跳过 (远超 10km)', () => {
    const events = [wuhanOffsetEvent(200)];
    const r = svc.matchComment(baseComment, events);
    expect(r.status).toBe('no_match');
    expect(r.candidate_event_id).toBe('');
  });

  it('跨 animal 兜底 (source=fallback) 200km → 保留软衰减, 不被硬过滤', () => {
    const events = [
      wuhanOffsetEvent(200, {
        event_id: 'e-fb-200',
        // 注意: animal_lat/lng 仍指武汉 (因为 EventRecallService 给所有事件赋同一个 animal 坐标)
        source: 'fallback',
      }),
    ];
    const r = svc.matchComment(baseComment, events);
    // fallback 不被硬过滤, 进入评分, 200km 软衰减扣 0.0075 (200 * 0.005)
    // 期望 status != no_match? 不一定, 因为 entity 命中 + sentiment 决定
    // 关键: 至少 match_score > 0 (证明 fallback 走完了评分, 没被硬过滤)
    expect(r.match_score).toBeGreaterThan(0);
  });

  it('animal 无坐标 → 跳过硬过滤, 走评分 (保守: 不假设动物位置)', () => {
    const events = [
      wuhanOffsetEvent(15, {
        event_id: 'e-no-animal-coord',
        animal_lat: undefined,
        animal_lng: undefined,
      }),
    ];
    const r = svc.matchComment(baseComment, events);
    // 没 animal 坐标 → 硬过滤不触发 (条件 'animalLat && animalLng' 不满足)
    expect(r.match_score).toBeGreaterThan(0);
  });

  it('geoHardFilterKm=0 (关闭硬过滤) → 200km 仍走评分', () => {
    // 改 rules
    const originalRules = (svc as any).rules;
    (svc as any).rules = { ...originalRules, geoHardFilterKm: 0 };
    try {
      const events = [wuhanOffsetEvent(200)];
      const r = svc.matchComment(baseComment, events);
      // 硬过滤关闭, 200km 事件走完评分, score > 0
      expect(r.match_score).toBeGreaterThan(0);
    } finally {
      (svc as any).rules = originalRules;
    }
  });

  it('边界值: 9.9999km 进入 / 10.0001km 跳过', () => {
    const inside = svc.matchComment(baseComment, [wuhanOffsetEvent(9.9999)]);
    expect(inside.match_score).toBeGreaterThan(0);

    const outside = svc.matchComment(baseComment, [wuhanOffsetEvent(10.0001)]);
    expect(outside.status).toBe('no_match');
  });
});
