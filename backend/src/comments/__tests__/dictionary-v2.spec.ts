// -*- coding: utf-8 -*-
/**
 * 【2026-07-10 阶段 E P0.0】DictionaryLoader v2 加载测试
 *
 * 背景: entities.json 实际是 version=2 (扩了 size/geo 分类), 但 _loadJson
 * 之前只接受 version=1, 导致整个文件被丢弃回退 BUILTIN, BUILTIN 没有 geo.
 * 修复: 改为白名单 [1, 2]. 本 spec 验证修复后 v2 真的能加载并被消费.
 *
 * 覆盖:
 *   1) v2 entities.json 加载后 categories.geo 存在, words >= 200
 *   2) v2 加载后, breed/color/size/feature/geo 五类齐全
 *   3) v1 仍然正常加载 (向后兼容)
 *   4) version=0 / version=3 (白名单外) 仍然回退 BUILTIN
 *   5) getJiebaUserWords 把 geo 词条也注入 (验证 v2 词条真被 jieba 看到)
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

describe('DictionaryLoader v2 加载 (阶段 E P0.0)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict_v2_'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('v2 entities.json 加载后 categories.geo 存在且 words >= 200', () => {
    // 准备一个最小 v2 实体集, geo 词 250 条
    const geoWords = ['武汉', '上海', '北京'];
    for (let i = 0; i < 247; i++) geoWords.push('地_' + i);
    const v2Entities = {
      version: 2,
      categories: {
        breed: { weight: 0.2, words: ['金毛', '柯基'] },
        color: { weight: 0.15, words: ['棕色', '黄色'] },
        size: { weight: 0.1, words: ['大型', '小型'] },
        feature: { weight: 0.15, words: ['断尾', '项圈'] },
        geo: { weight: 0.18, words: geoWords },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'entities.json'), JSON.stringify(v2Entities));

    const loader = new DictionaryLoader(makeCfg(tmpDir));
    loader.loadAll();

    const ent = loader.getEntities();
    expect(ent.version).toBe(2);
    expect(ent.categories.geo).toBeDefined();
    expect(ent.categories.geo.words.length).toBeGreaterThanOrEqual(250);
    expect(ent.categories.geo.words[0]).toBe('武汉');
  });

  it('v2 加载后 breed/color/size/feature/geo 五类齐全', () => {
    const v2Entities = {
      version: 2,
      categories: {
        breed: { weight: 0.2, words: ['金毛'] },
        color: { weight: 0.15, words: ['棕色'] },
        size: { weight: 0.1, words: ['大型'] },
        feature: { weight: 0.15, words: ['断尾'] },
        geo: { weight: 0.18, words: ['武汉', '上海'] },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'entities.json'), JSON.stringify(v2Entities));

    const loader = new DictionaryLoader(makeCfg(tmpDir));
    loader.loadAll();

    const cats = Object.keys(loader.getEntities().categories).sort();
    expect(cats).toEqual(['breed', 'color', 'feature', 'geo', 'size']);
  });

  it('v1 仍然正常加载 (向后兼容)', () => {
    const v1Entities = {
      version: 1,
      categories: {
        breed: { weight: 0.2, words: ['金毛'] },
        color: { weight: 0.15, words: ['棕色'] },
        feature: { weight: 0.15, words: ['断尾'] },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'entities.json'), JSON.stringify(v1Entities));

    const loader = new DictionaryLoader(makeCfg(tmpDir));
    loader.loadAll();

    const ent = loader.getEntities();
    expect(ent.version).toBe(1);
    expect(ent.categories.breed.words).toContain('金毛');
    // v1 没有 geo 分类
    expect(ent.categories.geo).toBeUndefined();
  });

  it('version=3 (白名单外) 仍然回退 BUILTIN, 不抛错', () => {
    const v3Entities = {
      version: 3,
      categories: {
        geo: { weight: 0.18, words: ['武汉'] },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'entities.json'), JSON.stringify(v3Entities));

    const loader = new DictionaryLoader(makeCfg(tmpDir));
    loader.loadAll();

    // 回退到 BUILTIN_DEFAULTS, BUILTIN 没有 geo
    const ent = loader.getEntities();
    expect(ent).toEqual(BUILTIN_DEFAULTS.entities);
    expect(ent.categories.geo).toBeUndefined();
  });

  it('getJiebaUserWords 把 v2 geo 词条也注入 (weight=0.18 * 100000 = 18000)', () => {
    const v2Entities = {
      version: 2,
      categories: {
        breed: { weight: 0.2, words: ['金毛'] },
        color: { weight: 0.15, words: ['棕色'] },
        size: { weight: 0.1, words: ['大型'] },
        feature: { weight: 0.15, words: ['断尾'] },
        geo: { weight: 0.18, words: ['武汉', '上海', '北京'] },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'entities.json'), JSON.stringify(v2Entities));

    const loader = new DictionaryLoader(makeCfg(tmpDir));
    loader.loadAll();

    const words = loader.getJiebaUserWords();
    const wordSet = new Set(words.map((w) => w.word));
    expect(wordSet.has('武汉')).toBe(true);
    expect(wordSet.has('上海')).toBe(true);
    expect(wordSet.has('北京')).toBe(true);
    // 验证 geo 分类的 weight 也正确传递
    const wh = words.find((w) => w.word === '武汉');
    expect(wh).toBeDefined();
    expect(wh!.weight).toBe(18000); // 0.18 * 100000
  });
});
