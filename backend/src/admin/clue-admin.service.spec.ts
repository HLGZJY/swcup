// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 D】ClueAdminService 单元测试
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClueAdminService } from './clue-admin.service';
import { DictionaryLoader } from '../comments/dictionary.loader';
import { DEFAULT_RULES } from '../comments/scoring-rules';
import { TextNormalizer } from '../comments/text-normalizer';

function makeCfg(dictsDir: string): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'CLUE_DICTS_DIR') return dictsDir;
      if (key === 'DICT_DISABLE_HOTRELOAD') return '1';
      return undefined;
    },
  } as any;
}

function makeDict(dictsDir: string): DictionaryLoader {
  const dict = new DictionaryLoader(makeCfg(dictsDir));
  dict.loadAll();
  return dict;
}

describe('ClueAdminService (阶段 D)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_admin_'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('dryRun: 返回候选事件评分, 且不调用持久化 matchComment', async () => {
    const clue = {
      listPending: jest.fn(() => ({})),
      decide: jest.fn(),
      getStateDir: jest.fn(() => tmpDir),
      getRules: jest.fn(() => DEFAULT_RULES),
      matchComment: jest.fn(),
    } as any;
    const ai = {
      moderate: jest.fn().mockResolvedValue({ primary_sentiment: 'report' }),
    } as any;
    const recall = {
      recall: jest.fn().mockResolvedValue([
        {
          event_id: 'e-1',
          event_type: 'report',
          reporter_id: 'u-2',
          occurred_at: '2026-07-09T10:00:00Z',
          address: '朝阳公园金毛走失',
        },
      ]),
    } as any;
    const dict = {
      getEntities: () => ({ version: 1, categories: { breed: { weight: 0.2, words: ['金毛'] } } }),
      getSynonyms: () => ({ version: 1, groups: [] }),
      getNegations: () => ({ version: 1, words: ['不是'] }),
    } as any;
    const service = new ClueAdminService(clue, ai, recall, dict, new TextNormalizer());

    const out = await service.dryRun({
      animal_id: 'a-1',
      content: '看到金毛',
      comment_time: '2026-07-09T10:00:00Z',
    });

    expect(out.score).toBeGreaterThanOrEqual(0.8);
    expect(out.candidate_event_id).toBe('e-1');
    expect((out.candidate_events as any[])[0].event_id).toBe('e-1');
    expect(clue.matchComment).not.toHaveBeenCalled();
  });

  it('getDicts / putDict: 读取并写回指定词库, 写后立即 reload', () => {
    const dict = makeDict(tmpDir);
    const service = new ClueAdminService({ listPending: () => ({}), getStateDir: () => tmpDir } as any, undefined, undefined, dict);

    expect(service.getDicts().entities).toBeDefined();
    const result = service.putDict('entities', {
      version: 1,
      categories: { breed: { weight: 0.2, words: ['边牧'] } },
    });

    expect(result).toEqual({ ok: true, category: 'entities', file: 'entities.json' });
    expect(dict.getEntities().categories.breed.words).toEqual(['边牧']);
    expect(fs.existsSync(path.join(tmpDir, 'entities.json'))).toBe(true);
  });

  it('putDict: 未知 category / 非法 schema 拒绝', () => {
    const dict = makeDict(tmpDir);
    const service = new ClueAdminService({ listPending: () => ({}), getStateDir: () => tmpDir } as any, undefined, undefined, dict);

    expect(() => service.putDict('unknown', { version: 1 })).toThrow(BadRequestException);
    expect(() => service.putDict('entities', { version: 1 })).toThrow(BadRequestException);
  });
});
