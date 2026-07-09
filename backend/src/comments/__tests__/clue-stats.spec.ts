// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 D】ClueStatsService 单元测试
 *
 * 覆盖:
 *   1) 扫描 clue_state/*.json 生成每日统计
 *   2) confirmed 命中率 / 平均分 / TOP 关键词
 *   3) rejected 关键词单独统计
 *   4) 损坏 JSON 容忍跳过
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ClueStatsService } from '../clue-stats.service';
import { MatchRecord } from '../file-state-store';

function makeCfg(stateDir: string): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'CLUE_STATE_DIR') return stateDir;
      if (key === 'CLUE_STATS_DISABLE_SCHEDULER') return '1';
      return undefined;
    },
  } as any;
}

function rec(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    match_id: 'm-1',
    comment_id: 'c-1',
    animal_id: 'a-1',
    comment_reporter_id: 'u-1',
    sentiment: 'report',
    keywords: ['金毛'],
    created_at: '2026-07-09T10:00:00Z',
    candidate_event_id: 'e-1',
    candidate_event_reporter_id: 'u-2',
    candidate_event_address: '朝阳公园',
    match_score: 0.8,
    match_reasons: [],
    status: 'pending',
    recorded_at: '2026-07-09T10:00:01Z',
    schema_version: 2,
    ...overrides,
  };
}

describe('ClueStatsService (阶段 D)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_stats_'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('生成每日统计 JSON: total / hit_rate / avg_score / TOP 关键词', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'a-1.json'),
      JSON.stringify([
        rec({ match_id: 'm-1', status: 'confirmed', match_score: 0.9, keywords: ['金毛', '棕色'] }),
        rec({ match_id: 'm-2', status: 'pending', match_score: 0.7, keywords: ['金毛'] }),
      ], null, 2),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'a-2.json'),
      JSON.stringify([
        rec({ match_id: 'm-3', animal_id: 'a-2', status: 'rejected', match_score: 0.5, keywords: ['棕色', '项圈'] }),
      ], null, 2),
    );

    const service = new ClueStatsService(makeCfg(tmpDir));
    const out = service.generateDailyStats(new Date('2026-07-09T12:00:00Z'));

    expect(out.date).toBe('2026-07-09');
    expect(out.total).toBe(3);
    expect(out.pending_count).toBe(1);
    expect(out.confirmed_count).toBe(1);
    expect(out.rejected_count).toBe(1);
    expect(out.hit_rate).toBeCloseTo(1 / 3, 4);
    expect(out.average_match_score).toBeCloseTo(0.7, 4);
    expect(out.top_keywords.slice(0, 2)).toEqual([
      { keyword: '金毛', count: 2 },
      { keyword: '棕色', count: 2 },
    ]);
    expect(out.rejected_keywords).toEqual([
      { keyword: '棕色', count: 1 },
      { keyword: '项圈', count: 1 },
    ]);

    const p = path.join(tmpDir, '_stats', '2026-07-09.json');
    expect(fs.existsSync(p)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(saved.total).toBe(3);
  });

  it('损坏 JSON 跳过, 空状态输出 0 统计', () => {
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{ invalid');
    const service = new ClueStatsService(makeCfg(tmpDir));
    const out = service.generateDailyStats(new Date('2026-07-10T00:00:00Z'));

    expect(out.total).toBe(0);
    expect(out.hit_rate).toBe(0);
    expect(out.average_match_score).toBe(0);
    expect(out.top_keywords).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, '_stats', '2026-07-10.json'))).toBe(true);
  });
});
