// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 C】FileStateStore 单元测试
 *
 * 覆盖:
 *   1) appendSync: 单条追加 + 立即可见
 *   2) append (async): 并发 10 写不丢
 *   3) .bak 备份生成
 *   4) update: status 流转 pending → confirmed, 二次 update 幂等
 *   5) loadList: 损坏 JSON → 返回空数组
 *   6) listAllPending: 跨 animal 列 pending
 *   7) onModuleInit 启动迁移: 旧 match_id → 新 match_id + match_id_v1
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { FileStateStore, MatchRecord, newMatchId } from '../file-state-store';

function makeCfg(stateDir: string): ConfigService {
  return { get: (key: string) => (key === 'CLUE_STATE_DIR' ? stateDir : undefined) } as any;
}

describe('FileStateStore (阶段 C)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file_state_'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleRec = (overrides: Partial<MatchRecord> = {}): MatchRecord => ({
    match_id: 'm-001',
    comment_id: 'c-001',
    animal_id: 'a-001',
    comment_reporter_id: 'u-1',
    sentiment: 'report',
    keywords: ['金毛'],
    created_at: '2026-07-09T10:00:00Z',
    candidate_event_id: 'e-001',
    candidate_event_reporter_id: 'u-2',
    candidate_event_address: '朝阳公园',
    match_score: 0.85,
    match_reasons: ['sentiment=report:+0.5'],
    status: 'pending',
    recorded_at: '2026-07-09T10:00:01Z',
    schema_version: 2,
    ...overrides,
  });

  describe('appendSync', () => {
    it('追加 1 条, loadList 立即可见', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      store.appendSync('a-001', sampleRec());
      const list = await store.loadList('a-001');
      expect(list.length).toBe(1);
      expect(list[0].match_id).toBe('m-001');
      expect(list[0].schema_version).toBe(2);
    });

    it('连续追加 3 条, 顺序保持', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      store.appendSync('a-001', sampleRec({ match_id: 'm-1' }));
      store.appendSync('a-001', sampleRec({ match_id: 'm-2' }));
      store.appendSync('a-001', sampleRec({ match_id: 'm-3' }));
      const list = await store.loadList('a-001');
      expect(list.map((r) => r.match_id)).toEqual(['m-1', 'm-2', 'm-3']);
    });

    it('产生 .bak 备份文件', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      store.appendSync('a-001', sampleRec({ match_id: 'm-1' }));
      store.appendSync('a-001', sampleRec({ match_id: 'm-2' }));
      const p = path.join(tmpDir, 'a-001.json');
      expect(fs.existsSync(p + '.bak')).toBe(true);
    });
  });

  describe('append (async, proper-lockfile)', () => {
    it('并发 10 写不丢', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          store.append('a-001', sampleRec({ match_id: 'm-' + i })),
        ),
      );
      const list = await store.loadList('a-001');
      expect(list.length).toBe(10);
      const ids = list.map((r) => r.match_id).sort();
      expect(ids).toEqual(
        Array.from({ length: 10 }, (_, i) => 'm-' + i).sort(),
      );
    });

    it('跨 animal 并发写不串文件', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      await Promise.all([
        store.append('a-1', sampleRec({ match_id: 'm-a-1' })),
        store.append('a-2', sampleRec({ match_id: 'm-a-2' })),
        store.append('a-1', sampleRec({ match_id: 'm-a-1-2' })),
        store.append('a-2', sampleRec({ match_id: 'm-a-2-2' })),
      ]);
      const l1 = await store.loadList('a-1');
      const l2 = await store.loadList('a-2');
      expect(l1.length).toBe(2);
      expect(l2.length).toBe(2);
    });
  });

  describe('update', () => {
    it('pending → confirmed, 二次 update 幂等 (返回 false)', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      await store.append('a-001', sampleRec({ match_id: 'm-1' }));
      const r1 = await store.update('a-001', 'm-1', {
        status: 'confirmed',
        decided_by: 'admin-1',
      });
      expect(r1).toBe(true);
      const r2 = await store.update('a-001', 'm-1', {
        status: 'rejected',
      });
      expect(r2).toBe(false); // 已 confirmed, 不再 pending
      const list = await store.loadList('a-001');
      expect(list[0].status).toBe('confirmed');
      expect(list[0].decided_by).toBe('admin-1');
    });

    it('match_id 不存在 → 返回 false (不改文件)', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      await store.append('a-001', sampleRec({ match_id: 'm-1' }));
      const r = await store.update('a-001', 'm-NOT-EXIST', { status: 'rejected' });
      expect(r).toBe(false);
      const list = await store.loadList('a-001');
      expect(list[0].status).toBe('pending');
    });
  });

  describe('loadList', () => {
    it('状态文件不存在 → 返回空数组', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      const list = await store.loadList('a-not-exists');
      expect(list).toEqual([]);
    });

    it('状态文件损坏 → 返回空数组 (不抛)', async () => {
      fs.writeFileSync(path.join(tmpDir, 'a-corrupt.json'), '{ invalid');
      const store = new FileStateStore(makeCfg(tmpDir));
      const list = await store.loadList('a-corrupt');
      expect(list).toEqual([]);
    });
  });

  describe('listAllPending', () => {
    it('跨 animal 列 pending (confirmed 过滤)', async () => {
      const store = new FileStateStore(makeCfg(tmpDir));
      await store.append('a-1', sampleRec({ match_id: 'm-1' }));
      await store.append('a-1', sampleRec({ match_id: 'm-2' }));
      await store.append('a-2', sampleRec({ match_id: 'm-3' }));
      await store.update('a-1', 'm-1', { status: 'confirmed' });
      const all = await store.listAllPending();
      expect(Object.keys(all).sort()).toEqual(['a-1', 'a-2']);
      expect(all['a-1'].length).toBe(1);
      expect(all['a-1'][0].match_id).toBe('m-2');
      expect(all['a-2'].length).toBe(1);
    });
  });

  describe('onModuleInit 启动迁移 (match_id 新格式)', () => {
    it('旧 match_id (无 eventId) → 新 match_id + match_id_v1', async () => {
      // 模拟旧数据
      const oldRec = {
        match_id: 'old-mid-16-chars', // 旧 16 字符 (但不含 eventId)
        comment_id: 'c-001',
        animal_id: 'a-001',
        comment_reporter_id: 'u-1',
        sentiment: 'report',
        keywords: [],
        created_at: '2026-07-09T10:00:00Z',
        candidate_event_id: 'e-001',
        candidate_event_reporter_id: 'u-2',
        candidate_event_address: '朝阳',
        match_score: 0.7,
        match_reasons: [],
        status: 'pending',
        recorded_at: '2026-07-09T10:00:01Z',
        // 注意: 旧数据没有 schema_version
      };
      fs.writeFileSync(
        path.join(tmpDir, 'a-001.json'),
        JSON.stringify([oldRec], null, 2),
      );

      const store = new FileStateStore(makeCfg(tmpDir));
      await store.onModuleInit();

      const list = await store.loadList('a-001');
      expect(list.length).toBe(1);
      expect(list[0].match_id_v1).toBe('old-mid-16-chars');
      expect(list[0].match_id).toBe(
        newMatchId('c-001', 'a-001', 'e-001', 'report'),
      );
      expect(list[0].schema_version).toBe(2);
    });

    it('缺 eventId → 新 match_id 用 unknown 占位', async () => {
      const oldRec = {
        match_id: 'old-2',
        comment_id: 'c-002',
        animal_id: 'a-001',
        sentiment: 'report',
        candidate_event_id: '', // 空
        status: 'pending',
        recorded_at: '2026-07-09T10:00:01Z',
      };
      fs.writeFileSync(
        path.join(tmpDir, 'a-001.json'),
        JSON.stringify([oldRec], null, 2),
      );
      const store = new FileStateStore(makeCfg(tmpDir));
      await store.onModuleInit();
      const list = await store.loadList('a-001');
      expect(list[0].match_id_v1).toBe('old-2');
      expect(list[0].match_id).toBe(
        newMatchId('c-002', 'a-001', '', 'report'),
      );
    });

    it('已是新格式 → 跳过迁移 (skipped++)', async () => {
      const newMid = newMatchId('c-003', 'a-001', 'e-003', 'report');
      const newRec = sampleRec({ match_id: newMid });
      fs.writeFileSync(
        path.join(tmpDir, 'a-001.json'),
        JSON.stringify([newRec], null, 2),
      );
      const store = new FileStateStore(makeCfg(tmpDir));
      await store.onModuleInit();
      const list = await store.loadList('a-001');
      expect(list[0].match_id).toBe(newMid);
      expect(list[0].match_id_v1).toBeUndefined();
    });

    it('输出 _migration.log', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'a-001.json'),
        JSON.stringify([
          {
            match_id: 'old',
            comment_id: 'c-1',
            animal_id: 'a-001',
            sentiment: 'report',
            candidate_event_id: 'e-1',
            status: 'pending',
          },
        ]),
      );
      const store = new FileStateStore(makeCfg(tmpDir));
      await store.onModuleInit();
      const logPath = path.join(tmpDir, '_migration.log');
      expect(fs.existsSync(logPath)).toBe(true);
      const log = fs.readFileSync(logPath, 'utf8');
      expect(log).toMatch(/migration done: migrated=1/);
    });
  });

  describe('newMatchId', () => {
    it('含 eventId 的新 hash 稳定', () => {
      const a = newMatchId('c1', 'a1', 'e1', 'report');
      const b = newMatchId('c1', 'a1', 'e1', 'report');
      expect(a).toBe(b);
      expect(a.length).toBe(16);
    });
    it('不同 eventId → 不同 match_id', () => {
      const a = newMatchId('c1', 'a1', 'e1', 'report');
      const b = newMatchId('c1', 'a1', 'e2', 'report');
      expect(a).not.toBe(b);
    });
    it('缺 eventId 用 unknown 占位 (稳定)', () => {
      const a = newMatchId('c1', 'a1', '', 'report');
      const expected = createHash('sha256')
        .update('c1|a1|unknown|report', 'utf8')
        .digest('hex')
        .slice(0, 16);
      expect(a).toBe(expected);
    });
  });
});
