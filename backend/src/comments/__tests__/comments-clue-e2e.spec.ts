// -*- coding: utf-8 -*-
/**
 * Clue é—­çŽ¯ e2e æµ‹è¯• (P3 2026-07-07)
 * éªŒè¯:
 *   1) ClueBridgeService åˆ‡è¯ (3 æ¡£é™çº§)
 *   2) matchComment: pending / self_match / no_match ä¸‰ç§è¯­ä¹‰
 *   3) listPending + decide ä¿®æ”¹ JSON çŠ¶æ€
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClueBridgeService } from '../clue-bridge.service';
import { Comment } from '../entities/comment.entity';
import { Animal } from '../../animals/entities/animal.entity';
import { RescueEvent } from '../../events/entities/event.entity';

describe('ClueBridgeService P3 e2e', () => {
  let svc: ClueBridgeService;
  let tmpState: string;

  beforeAll(async () => {
    tmpState = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_e2e_'));
    const cfg: Partial<ConfigService> = {
      get: jest.fn((key: string) => {
        if (key === 'CLUE_STATE_DIR') return tmpState;
        return undefined as any;
      }),
    };
    // 【2026-07-09 阶段 A】ClueBridgeService 注入 3 个 repo (用于 _persistConfirm 副作用)
    // 本测试只覆盖切词/匹配/JSON 读写,不触发 confirm 分支,所以 mock 为空壳即可
    const emptyRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(async () => ({ affected: 1 })),
      create: jest.fn((dto: any) => dto),
    };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ClueBridgeService,
        { provide: ConfigService, useValue: cfg },
        { provide: getRepositoryToken(Comment), useValue: emptyRepo },
        { provide: getRepositoryToken(Animal), useValue: emptyRepo },
        { provide: getRepositoryToken(RescueEvent), useValue: emptyRepo },
      ],
    }).compile();
    svc = mod.get(ClueBridgeService);
    svc.init();
  });

  it('åˆ‡è¯å™¨å·²åˆå§‹åŒ– (æŸç§ segmenter)', () => {
    const k = svc.getSegmenterKind();
    expect(['nodejieba', 'segmentit', 'fallback']).toContain(k);
    console.log('[e2e] segmenter =', k);
  });

  it('A æ¡£: ç›®å‡»è¯„è®º + åŒåœ°å€äº‹ä»¶ â†’ pending', () => {
    const events = [
      {
        event_id: 'e1', event_type: 'report', reporter_id: 'u_owner',
        occurred_at: '2026-07-06T08:00:00Z',
        address: 'åŒ—äº¬æœé˜³åŒºæœé˜³å…¬å›­å—é—¨', description: 'é‡‘æ¯›èµ°å¤±',
      },
    ];
    const r = svc.matchComment(
      {
        comment_id: 'c001', animal_id: 'a001',
        content: 'æˆ‘åˆšåœ¨æœé˜³å…¬å›­çœ‹åˆ°ä¸€åªé‡‘æ¯›',
        reporter_id: 'u_x', sentiment: 'report',
        created_at: '2026-07-06T10:00:00Z',
      },
      events,
    );
    console.log('[e2e A] status=', r.status, 'score=', r.match_score, 'candidate=', r.candidate_event_id);
    expect(r.status).toBe('pending');
    expect(r.candidate_event_id).toBe('e1');
    expect(r.match_score).toBeGreaterThanOrEqual(0.5);
    expect(r.keywords.length).toBeGreaterThan(0);
  });

  it('B æ¡£: è¯„è®ºäºº == äº‹ä»¶ reporter â†’ self_match', () => {
    const r = svc.matchComment(
      {
        comment_id: 'c002', animal_id: 'a001',
        content: 'æˆ‘åˆšåœ¨æœé˜³å…¬å›­çœ‹åˆ°ä¸€åª',
        reporter_id: 'u_owner', sentiment: 'report',
        created_at: '2026-07-06T10:00:00Z',
      },
      [{ event_id: 'e1', event_type: 'report', reporter_id: 'u_owner', occurred_at: '2026-07-06T08:00:00Z', address: 'æœé˜³å…¬å›­', description: '' }],
    );
    expect(r.status).toBe('self_match');
  });

  it('C æ¡£: é¼“åŠ±æ€§è¯„è®º â†’ no_match', () => {
    const r = svc.matchComment(
      {
        comment_id: 'c003', animal_id: 'a001',
        content: 'å¸Œæœ›å®ƒå¿«ç‚¹æ‰¾åˆ°ä¸»äºº,åŠ æ²¹',
        reporter_id: 'u_x', sentiment: 'thanks',
        created_at: '2026-07-06T10:00:00Z',
      },
      [{ event_id: 'e1', event_type: 'report', reporter_id: 'u_owner', occurred_at: '2026-07-06T08:00:00Z', address: 'æœé˜³å…¬å›­', description: '' }],
    );
    expect(r.status).toBe('no_match');
  });

  it('D æ¡£: äº‹ä»¶è¡¨ç©º â†’ no_match', () => {
    const r = svc.matchComment(
      {
        comment_id: 'c004', animal_id: 'a001',
        content: 'æˆ‘åˆšåœ¨æœé˜³å…¬å›­çœ‹åˆ°ä¸€åª',
        reporter_id: 'u_x', sentiment: 'report',
        created_at: '2026-07-06T10:00:00Z',
      },
      [],
    );
    expect(r.status).toBe('no_match');
  });

  it('listPending èƒ½åˆ—å‡ºä¸Šä¸€æ­¥çš„ pending', () => {
    const pending = svc.listPending();
    console.log('[e2e list] keys=', Object.keys(pending));
    expect(pending['a001']).toBeDefined();
    expect(pending['a001'].length).toBe(1);
    expect(pending['a001'][0].comment_id).toBe('c001');
  });

  it('decide 能改 pending → confirmed', async () => {
    const pending = svc.listPending();
    const target = pending['a001'][0];
    // 【2026-07-09 阶段 A】decide 改为 async, 返回 { ok, persisted? }
    const r = await svc.decide(target.match_id, 'a001', 'confirmed', 'note', 'admin1');
    expect(r.ok).toBe(true);

    // 再 list 应该空了
    const after = svc.listPending();
    expect(after['a001']).toBeUndefined();
  });

  it('再次 decide 同一 match_id → false (幂等)', async () => {
    const r = await svc.decide('5295edaa0e429619', 'a001', 'confirmed', '', 'admin1');
    expect(r.ok).toBe(false);
  });
});