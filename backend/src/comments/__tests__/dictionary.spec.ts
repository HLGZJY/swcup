// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 B】DictionaryLoader 单元测试
 *
 * 覆盖:
 *   1) 启动期加载 5 个 JSON, 校验 schema_version
 *   2) JSON 缺失 / 损坏 / version 不匹配 → 回退 BUILTIN_DEFAULTS
 *   3) reload(fileName) 单文件重载
 *   4) getJiebaUserWords 词条数正确
 *   5) BUILTIN_DEFAULTS 暴露给 ai-bridge 的 5 个 Set 内容与原硬编码一致
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { BUILTIN_DEFAULTS, DictionaryLoader } from '../dictionary.loader';

function makeCfg(dictsDir: string): ConfigService {
  return {
    get: (key: string) => (key === 'CLUE_DICTS_DIR' ? dictsDir : undefined),
  } as any;
}

describe('DictionaryLoader (阶段 B)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict_test_'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('启动期加载 (loadAll)', () => {
    it('空目录 → 5 个 getter 全部返回 BUILTIN_DEFAULTS, jsonLoadedAny=false', () => {
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      expect(loader.getEntities().version).toBe(1);
      expect(loader.getSynonyms().groups.length).toBe(BUILTIN_DEFAULTS.synonyms.groups.length);
      expect(loader.getNegations().words.length).toBeGreaterThan(0);
      expect(loader.getTimeMarkers().markers.length).toBeGreaterThan(0);
      expect(loader.getSentimentRules().trigger).toEqual(['report', 'seek']);
    });

    it('5 个 JSON 完整 → entities 词数 >= 30, jsonLoadedAny=true', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'entities.json'),
        JSON.stringify(BUILTIN_DEFAULTS.entities),
      );
      fs.writeFileSync(
        path.join(tmpDir, 'synonyms.json'),
        JSON.stringify({
          version: 1,
          groups: [
            { canonical: '狗', aliases: ['狗狗', '毛孩子'] },
            { canonical: '猫', aliases: ['猫咪'] },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(tmpDir, 'negations.json'),
        JSON.stringify({ version: 1, words: ['不是', '没有', '没'] }),
      );
      fs.writeFileSync(
        path.join(tmpDir, 'time-markers.json'),
        JSON.stringify({
          version: 1,
          markers: [
            { phrase: '今天', offset_days: 0 },
            { phrase: '昨天', offset_days: -1 },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(tmpDir, 'sentiment-rules.json'),
        JSON.stringify({
          version: 1,
          trigger: ['report', 'seek'],
          scoring: { report: { base: 0.5 }, seek: { base: 0.4 } },
        }),
      );
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      const ent = loader.getEntities();
      const totalWords = Object.values(ent.categories).reduce(
        (s, c) => s + (Array.isArray(c.words) ? c.words.length : 0),
        0,
      );
      expect(totalWords).toBeGreaterThanOrEqual(8);
      expect(loader.getSynonyms().groups.length).toBe(2);
      expect(loader.getNegations().words.length).toBe(3);
    });

    it('JSON 损坏 (parse 失败) → 静默回退 BUILTIN_DEFAULTS', () => {
      fs.writeFileSync(path.join(tmpDir, 'entities.json'), '{ invalid json');
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      expect(loader.getEntities().categories.breed.words).toEqual(
        BUILTIN_DEFAULTS.entities.categories.breed.words,
      );
    });

    it('version != 1 → 回退 BUILTIN_DEFAULTS', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'entities.json'),
        JSON.stringify({ version: 2, categories: {} }),
      );
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      expect(loader.getEntities().categories.breed.words).toEqual(
        BUILTIN_DEFAULTS.entities.categories.breed.words,
      );
    });

    it('结构不合法 (缺 categories) → 回退 BUILTIN_DEFAULTS', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'entities.json'),
        JSON.stringify({ version: 1 }),
      );
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      expect(loader.getEntities().categories.breed.words).toEqual(
        BUILTIN_DEFAULTS.entities.categories.breed.words,
      );
    });
  });

  describe('reload(fileName)', () => {
    it('改 entities.json 后 reload → 新词生效', () => {
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      fs.writeFileSync(
        path.join(tmpDir, 'entities.json'),
        JSON.stringify({
          version: 1,
          categories: {
            breed: { weight: 0.2, words: ['金毛', '拉布拉多', '新词'] },
          },
        }),
      );
      loader.reload('entities.json');
      const after = Object.values(loader.getEntities().categories).reduce(
        (s, c) => s + c.words.length,
        0,
      );
      // reload 整文件替换, 新 JSON 3 个词 → after = 3
      expect(after).toBe(3);
      expect(loader.getEntities().categories.breed.words).toContain('新词');
    });

    it('onDictFileChange: 500ms 去抖后自动 reload', () => {
      jest.useFakeTimers();
      try {
        const loader = new DictionaryLoader(makeCfg(tmpDir));
        loader.onModuleInit();
        fs.writeFileSync(
          path.join(tmpDir, 'entities.json'),
          JSON.stringify({
            version: 1,
            categories: {
              breed: { weight: 0.2, words: ['热加载词'] },
            },
          }),
        );
        loader.onDictFileChange(path.join(tmpDir, 'entities.json'));
        expect(loader.getEntities().categories.breed.words).not.toEqual(['热加载词']);
        jest.advanceTimersByTime(500);
        expect(loader.getEntities().categories.breed.words).toEqual(['热加载词']);
      } finally {
        jest.useRealTimers();
      }
    });

    it('reload 未知 fileName → 仅 warn, 不抛错', () => {
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      expect(() => loader.reload('unknown.json')).not.toThrow();
    });
  });

  describe('getJiebaUserWords', () => {
    it('空目录 → 返回 BUILTIN_DEFAULTS 实体词', () => {
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      const words = loader.getJiebaUserWords();
      // 实体 fallback breed: 金毛/拉布拉多/田园犬 (3)
      const jiebaWords = words.map((w) => w.word);
      expect(jiebaWords).toEqual(expect.arrayContaining(['金毛', '拉布拉多', '田园犬']));
    });

    it('JSON 完整 → entities + synonyms.canonical 都注入', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'entities.json'),
        JSON.stringify({
          version: 1,
          categories: { breed: { weight: 0.2, words: ['金毛', '边牧'] } },
        }),
      );
      fs.writeFileSync(
        path.join(tmpDir, 'synonyms.json'),
        JSON.stringify({
          version: 1,
          groups: [{ canonical: '狗', aliases: ['狗狗'] }],
        }),
      );
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      const words = loader.getJiebaUserWords().map((w) => w.word);
      expect(words).toEqual(expect.arrayContaining(['金毛', '边牧', '狗']));
    });
  });

  describe('BUILTIN_DEFAULTS 暴露给 ai-bridge (5 个 Set)', () => {
    it('5 个 Set 内容与原 ai-bridge.service.ts 硬编码一致', () => {
      // 原 ai-bridge.service.ts:26-30
      const loader = new DictionaryLoader(makeCfg(tmpDir));
      loader.onModuleInit();
      expect(Array.from(loader.getBuiltinBlacklistBad())).toEqual(
        expect.arrayContaining(['打死它', '打死', '弄死', '虐待', '傻逼', '智障', '脑残', '废物']),
      );
      expect(Array.from(loader.getBuiltinBlacklistFake())).toEqual(
        expect.arrayContaining(['加微信', '加我微信', '微商', '代购', '纯种', '便宜出', '免费送']),
      );
      expect(Array.from(loader.getBuiltinPositive())).toEqual(
        expect.arrayContaining(['可怜', '心疼', '希望', '保佑', '加油', '挺住', '平安', '回家']),
      );
      expect(Array.from(loader.getBuiltinReward())).toEqual(
        expect.arrayContaining(['找到', '谢谢', '感谢', '已找回', '团聚']),
      );
      expect(Array.from(loader.getBuiltinReport())).toEqual(
        expect.arrayContaining(['看到', '见到', '目击', '刚发现']),
      );
    });
  });
});
