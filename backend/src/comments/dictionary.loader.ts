// -*- coding: utf-8 -*-
/**
 * dictionary.loader.ts
 * 阶段 B: 词库外置 + 加载回退 (PR #1)
 * 阶段 E: 扩 6 个情感词典 JSON (2026-07-14 bug收尾)
 *
 * 职责:
 *  - 启动期加载 backend/data/dicts/*.json
 *    · 5 个分层词库 (entities / synonyms / negations / time-markers / sentiment-rules)
 *    · 6 个情感词表 (badwords / fake_keywords / care_keywords / seek_keywords / report_keywords / thanks_keywords)
 *  - 加载失败 / version 不匹配 → 回退 BUILTIN_DEFAULTS (含原 5 个 Set + 新 seek Set)
 *  - 暴露 getEntities/getSynonyms/getNegations/getTimeMarkers/getSentimentRules
 *  - 暴露 getBadwords/getFakeKeywords/getCareKeywords/getSeekKeywords/getReportKeywords/getThanksKeywords (新)
 *    优先读 JSON, 缺失 fallback BUILTIN_DEFAULTS 对应 Set
 *  - 暴露 reload(fileName) 给 Phase D chokidar 调用
 *  - 暴露 getJiebaUserWords() 给 makeNodeJiebaSegmenter 注入业务词
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import chokidar, { FSWatcher } from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';

// ---------------- 类型定义 ----------------

export interface EntityCategory {
  weight: number;
  words: string[];
}
export interface EntitiesDict {
  version: number;
  categories: Record<string, EntityCategory>;
}
export interface SynonymGroup {
  canonical: string;
  aliases: string[];
}
export interface SynonymsDict {
  version: number;
  groups: SynonymGroup[];
}
export interface NegationsDict {
  version: number;
  words: string[];
}
export interface TimeMarker {
  phrase: string;
  offset_days: number;
}
export interface TimeMarkersDict {
  version: number;
  markers: TimeMarker[];
}
export interface SentimentRule {
  base: number;
}
export interface SentimentRulesDict {
  version: number;
  trigger: string[];
  scoring: Record<string, SentimentRule>;
}

/**
 * 【2026-07-14 阶段 E】通用情感词表 schema
 *  与 ai-service/src/comments/dict_loader.py 兼容
 *  (entries 是 frozenset;weight_hint 暂未在 stubModerate 用)
 */
export interface WordListDict {
  version: number | string;
  description?: string;
  weight_hint?: number;
  entries: string[];
}

export interface JiebaUserWord {
  word: string;
  weight: number;
}

// ---------------- BUILTIN_DEFAULTS (原 5 个 Set 迁出 + 实体/时间/否定/同义/情感 fallback) ----------------

export const BUILTIN_DEFAULTS = {
  /** 原 ai-bridge.service.ts:26 BLACKLIST_BAD */
  blacklist_bad: new Set<string>(['打死它', '打死', '弄死', '虐待', '傻逼', '智障', '脑残', '废物', '骗子', '骗人', '黑心', '敲诈', '砍价', '骗']),
  /** 原 ai-bridge.service.ts:27 BLACKLIST_FAKE */
  blacklist_fake: new Set<string>(['加微信', '加我微信', '微商', '代购', '纯种', '便宜出', '免费送', '广告', '推广', '扫码', '点链接', '出售', '买卖']),
  /** 原 ai-bridge.service.ts:28 POSITIVE */
  positive: new Set<string>(['可怜', '心疼', '希望', '保佑', '加油', '挺住', '平安', '回家']),
  /** 原 ai-bridge.service.ts:29 REWARD */
  reward: new Set<string>(['找到', '谢谢', '感谢', '已找回', '团聚']),
  /** 原 ai-bridge.service.ts:30 REPORT + 阶段 E 扩展 (2026-07-14 bug3 档位 1):
   *  覆盖真实微信用户表达"我在 xx 路看到了"等场景,
   *  避免 5 词典过窄导致 sentiment 全走 default NEUTRAL/CARE */
  report: new Set<string>([
    '看到', '见到', '目击', '刚发现',
    '看到过', '在路上看到', '在路上见到', '路上看到了', '路上见到',
    '门口看到', '公园看到', '附近看到', '散步看到', '散步见到',
    '刚才看到', '今天看到', '晚上看到', '明天看到',
    '遇到过', '碰见', '碰上', '撞见', '遇到', '发现', '找见',
  ]),

  /** 【2026-07-14 bug一致性】补 SEEK fallback —
   *  原 ai-bridge stubModerate 缺 SEEK 分类, 用户"求求大家帮找"等评论落 NEUTRAL,
   *  不触发 clue.matchComment → 不进 clue_state → admin 看不到
   *  修复: stubModerate 加 SEEK 分支, fallback 用此 Set */
  seek: new Set<string>([
    '求求', '帮忙找', '帮我找', '求帮忙', '求助', '求转发',
    '寻找', '寻狗', '寻猫', '走失', '丢失', '不见了', '失踪',
    '找回来', '找到它', '希望找到', '帮忙转发', '拜托', '求求大家',
    '谁能帮我', '谁看到了', '大家帮帮忙', '求扩散', '求好心人',
    '急寻', '紧急寻狗', '紧急寻猫',
  ]),

  /** 实体 fallback (entities.json 缺失时用) */
  entities: {
    version: 1,
    categories: {
      breed: { weight: 0.2, words: ['金毛', '拉布拉多', '田园犬'] },
      color: { weight: 0.15, words: ['棕色', '黄色', '黑色'] },
      feature: { weight: 0.15, words: ['断尾', '左耳缺口', '项圈'] },
    },
  } as EntitiesDict,

  synonyms: { version: 1, groups: [] as SynonymGroup[] } as SynonymsDict,
  negations: { version: 1, words: ['不是', '不像', '没'] } as NegationsDict,
  timeMarkers: { version: 1, markers: [{ phrase: '昨天', offset_days: -1 }] } as TimeMarkersDict,
  sentimentRules: {
    version: 1,
    trigger: ['report', 'seek'],
    scoring: {
      report: { base: 0.5 },
      seek: { base: 0.4 },
    },
  } as SentimentRulesDict,
};

// ---------------- DictionaryLoader 主类 ----------------

const DICT_FILES = [
  'entities.json', 'synonyms.json', 'negations.json', 'time-markers.json', 'sentiment-rules.json',
  // 【2026-07-14 阶段 E】6 个情感词表, schema 与 ai-service dict_loader.py 兼容
  'badwords.json', 'fake_keywords.json', 'care_keywords.json', 'seek_keywords.json', 'report_keywords.json', 'thanks_keywords.json',
] as const;
type DictFileName = (typeof DICT_FILES)[number];

// 通用词表文件 → BUILTIN_DEFAULTS fallback key 的映射
const WORD_LIST_FALLBACK: Partial<Record<DictFileName, () => Set<string>>> = {
  'badwords.json': () => BUILTIN_DEFAULTS.blacklist_bad,
  'fake_keywords.json': () => BUILTIN_DEFAULTS.blacklist_fake,
  'care_keywords.json': () => BUILTIN_DEFAULTS.positive,
  'seek_keywords.json': () => BUILTIN_DEFAULTS.seek,
  'report_keywords.json': () => BUILTIN_DEFAULTS.report,
  'thanks_keywords.json': () => BUILTIN_DEFAULTS.reward,
};

function _entriesToSet(d: WordListDict): Set<string> {
  return new Set((Array.isArray(d.entries) ? d.entries : []).filter((w) => typeof w === 'string' && w.length > 0));
}

@Injectable()
export class DictionaryLoader implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DictionaryLoader.name);
  private dictsDir: string;
  private watcher: FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;
  private reloadQueue: string[] = [];

  private entities: EntitiesDict = BUILTIN_DEFAULTS.entities;
  private synonyms: SynonymsDict = BUILTIN_DEFAULTS.synonyms;
  private negations: NegationsDict = BUILTIN_DEFAULTS.negations;
  private timeMarkers: TimeMarkersDict = BUILTIN_DEFAULTS.timeMarkers;
  private sentimentRules: SentimentRulesDict = BUILTIN_DEFAULTS.sentimentRules;

  // 【2026-07-14 阶段 E】6 个情感词表 loaded 内存, 缺失 JSON 时 fallback BUILTIN_DEFAULTS
  private badwords: Set<string> = new Set(BUILTIN_DEFAULTS.blacklist_bad);
  private fakeKeywords: Set<string> = new Set(BUILTIN_DEFAULTS.blacklist_fake);
  private careKeywords: Set<string> = new Set(BUILTIN_DEFAULTS.positive);
  private seekKeywords: Set<string> = new Set(BUILTIN_DEFAULTS.seek);
  private reportKeywords: Set<string> = new Set(BUILTIN_DEFAULTS.report);
  private thanksKeywords: Set<string> = new Set(BUILTIN_DEFAULTS.reward);

  /** 启动期是否至少 1 个 JSON 加载成功 (用于 assert BUILTIN_DEFAULTS 与 JSON 一致性) */
  private jsonLoadedAny = false;

  constructor(private readonly cfg: ConfigService) {
    this.dictsDir =
      this.cfg.get<string>('CLUE_DICTS_DIR') || path.join(process.cwd(), 'data', 'dicts');
  }

  onModuleInit(): void {
    this.loadAll();
    this.startHotReload();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    if (this.watcher) await this.watcher.close();
  }

  /** 全量加载所有 JSON, 失败各自回退 BUILTIN_DEFAULTS */
  loadAll(): void {
    this.entities = this._loadJson('entities.json', BUILTIN_DEFAULTS.entities, (o) => {
      return typeof o === 'object' && o !== null && (o as any).categories && typeof (o as any).categories === 'object';
    });
    this.synonyms = this._loadJson('synonyms.json', BUILTIN_DEFAULTS.synonyms, (o) => {
      return typeof o === 'object' && o !== null && Array.isArray((o as any).groups);
    });
    this.negations = this._loadJson('negations.json', BUILTIN_DEFAULTS.negations, (o) => {
      return typeof o === 'object' && o !== null && Array.isArray((o as any).words);
    });
    this.timeMarkers = this._loadJson('time-markers.json', BUILTIN_DEFAULTS.timeMarkers, (o) => {
      return typeof o === 'object' && o !== null && Array.isArray((o as any).markers);
    });
    this.sentimentRules = this._loadJson('sentiment-rules.json', BUILTIN_DEFAULTS.sentimentRules, (o) => {
      return (
        typeof o === 'object' &&
        o !== null &&
        Array.isArray((o as any).trigger) &&
        typeof (o as any).scoring === 'object'
      );
    });

    // 【2026-07-14 阶段 E】6 个情感词表加载
    this.badwords = this._loadWordList('badwords.json', BUILTIN_DEFAULTS.blacklist_bad);
    this.fakeKeywords = this._loadWordList('fake_keywords.json', BUILTIN_DEFAULTS.blacklist_fake);
    this.careKeywords = this._loadWordList('care_keywords.json', BUILTIN_DEFAULTS.positive);
    this.seekKeywords = this._loadWordList('seek_keywords.json', BUILTIN_DEFAULTS.seek);
    this.reportKeywords = this._loadWordList('report_keywords.json', BUILTIN_DEFAULTS.report);
    this.thanksKeywords = this._loadWordList('thanks_keywords.json', BUILTIN_DEFAULTS.reward);

    const entCount = Object.values(this.entities.categories).reduce(
      (s, c) => s + (Array.isArray(c.words) ? c.words.length : 0),
      0,
    );
    this.logger.log(
      `[DictionaryLoader.loadAll] dir=${this.dictsDir} ` +
        `entities_words=${entCount} synonyms_groups=${this.synonyms.groups.length} ` +
        `negations=${this.negations.words.length} time_markers=${this.timeMarkers.markers.length} ` +
        `badwords=${this.badwords.size} fake=${this.fakeKeywords.size} ` +
        `care=${this.careKeywords.size} seek=${this.seekKeywords.size} ` +
        `report=${this.reportKeywords.size} thanks=${this.thanksKeywords.size} ` +
        `json_loaded_any=${this.jsonLoadedAny}`,
    );
  }

  /**
   * 单文件重载 (Phase D chokidar 调用入口, PR #1 仅暴露方法)
   * 找不到 fileName 时不抛, 仅 warn
   */
  reload(fileName: string): void {
    if (!DICT_FILES.includes(fileName as DictFileName)) {
      this.logger.warn(`[DictionaryLoader.reload] unknown file: ${fileName}`);
      return;
    }
    switch (fileName as DictFileName) {
      case 'entities.json':
        this.entities = this._loadJson('entities.json', this.entities, (o) => !!o && !!o.categories);
        break;
      case 'synonyms.json':
        this.synonyms = this._loadJson('synonyms.json', this.synonyms, (o) => !!o && Array.isArray(o.groups));
        break;
      case 'negations.json':
        this.negations = this._loadJson('negations.json', this.negations, (o) => !!o && Array.isArray(o.words));
        break;
      case 'time-markers.json':
        this.timeMarkers = this._loadJson('time-markers.json', this.timeMarkers, (o) => !!o && Array.isArray(o.markers));
        break;
      case 'sentiment-rules.json':
        this.sentimentRules = this._loadJson('sentiment-rules.json', this.sentimentRules, (o) => !!o && Array.isArray(o.trigger));
        break;
      // 【2026-07-14 阶段 E】6 个情感词表热重载
      case 'badwords.json':
        this.badwords = this._loadWordList('badwords.json', BUILTIN_DEFAULTS.blacklist_bad);
        break;
      case 'fake_keywords.json':
        this.fakeKeywords = this._loadWordList('fake_keywords.json', BUILTIN_DEFAULTS.blacklist_fake);
        break;
      case 'care_keywords.json':
        this.careKeywords = this._loadWordList('care_keywords.json', BUILTIN_DEFAULTS.positive);
        break;
      case 'seek_keywords.json':
        this.seekKeywords = this._loadWordList('seek_keywords.json', BUILTIN_DEFAULTS.seek);
        break;
      case 'report_keywords.json':
        this.reportKeywords = this._loadWordList('report_keywords.json', BUILTIN_DEFAULTS.report);
        break;
      case 'thanks_keywords.json':
        this.thanksKeywords = this._loadWordList('thanks_keywords.json', BUILTIN_DEFAULTS.reward);
        break;
    }
    this.logger.log(`[DictionaryLoader.reload] reloaded ${fileName}`);
  }

  /** chokidar 热加载: 监听 data/dicts/*.json, 500ms 去抖后逐文件 reload */
  private startHotReload(): void {
    if (this.cfg.get<string>('DICT_DISABLE_HOTRELOAD') === '1') return;
    if (this.cfg.get<string>('CLUE_DICT_DISABLE_HOTRELOAD') === '1') return;
    if (process.env.NODE_ENV === 'test') return;
    try {
      fs.mkdirSync(this.dictsDir, { recursive: true });
      this.watcher = chokidar.watch(path.join(this.dictsDir, '*.json'), {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });
      this.watcher.on('add', (p) => this.onDictFileChange(p));
      this.watcher.on('change', (p) => this.onDictFileChange(p));
      this.watcher.on('error', (e) => {
        this.logger.warn(`[DictionaryLoader.hotReload] watcher error: ${String(e)}`);
      });
      this.logger.log(`[DictionaryLoader.hotReload] watching ${this.dictsDir}`);
    } catch (e: any) {
      this.logger.warn(`[DictionaryLoader.hotReload] disabled: ${e?.message || e}`);
    }
  }

  onDictFileChange(filePath: string): void {
    const fileName = path.basename(filePath);
    this.reloadQueue = Array.from(new Set([...this.reloadQueue, fileName]));
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      const files = this.reloadQueue;
      this.reloadQueue = [];
      for (const name of files) this.reload(name);
    }, 500);
  }

  // ---------------- Getters ----------------

  getEntities(): EntitiesDict {
    return this.entities;
  }
  getSynonyms(): SynonymsDict {
    return this.synonyms;
  }
  getNegations(): NegationsDict {
    return this.negations;
  }
  getTimeMarkers(): TimeMarkersDict {
    return this.timeMarkers;
  }
  getSentimentRules(): SentimentRulesDict {
    return this.sentimentRules;
  }

  // 【2026-07-14 阶段 E】6 个情感词表 getter — 优先 JSON, 缺失 fallback BUILTIN_DEFAULTS
  //   运营改 backend/data/dicts/*.json → chokidar 监听 → 热重载, 无需重启
  getBadwords(): Set<string> {
    return this.badwords;
  }
  getFakeKeywords(): Set<string> {
    return this.fakeKeywords;
  }
  getCareKeywords(): Set<string> {
    return this.careKeywords;
  }
  getSeekKeywords(): Set<string> {
    return this.seekKeywords;
  }
  getReportKeywords(): Set<string> {
    return this.reportKeywords;
  }
  getThanksKeywords(): Set<string> {
    return this.thanksKeywords;
  }

  // ---------------- BUILTIN_DEFAULTS 访问入口 (供 ai-bridge.service 用, 替代原 5 个 Set) ----------------
  // 【2026-07-14 阶段 E】保留以兼容, 但 stubModerate 已改用 getBadwords/getReportKeywords 等带 JSON 加载的 getter

  getBuiltinBlacklistBad(): Set<string> {
    return BUILTIN_DEFAULTS.blacklist_bad;
  }
  getBuiltinBlacklistFake(): Set<string> {
    return BUILTIN_DEFAULTS.blacklist_fake;
  }
  getBuiltinPositive(): Set<string> {
    return BUILTIN_DEFAULTS.positive;
  }
  getBuiltinReward(): Set<string> {
    return BUILTIN_DEFAULTS.reward;
  }
  getBuiltinReport(): Set<string> {
    return BUILTIN_DEFAULTS.report;
  }

  // ---------------- Jieba 注入 ----------------

  /**
   * 把 entities 全部词 + synonyms.canonical 转成 jieba 词条
   * nodejieba.insertWord(word) 没有 weight 参数 (第二参数是 tag 字符串)
   * 所以这里只返回 word, weight 字段保留供 PR #2 segmenter 评分时参考 (后续可加权)
   */
  getJiebaUserWords(): JiebaUserWord[] {
    const out: JiebaUserWord[] = [];
    for (const cat of Object.values(this.entities.categories)) {
      if (!Array.isArray(cat.words)) continue;
      const w = Math.max(1, Math.floor(cat.weight * 100000));
      for (const word of cat.words) {
        if (word && typeof word === 'string') out.push({ word, weight: w });
      }
    }
    for (const g of this.synonyms.groups) {
      if (g.canonical && typeof g.canonical === 'string') {
        out.push({ word: g.canonical, weight: 50000 });
      }
    }
    return out;
  }

  getDictsDir(): string {
    return this.dictsDir;
  }

  // ---------------- 私有方法 ----------------

  private _loadJson<T extends { version: number }>(
    fileName: string,
    fallback: T,
    validator: (o: any) => boolean,
  ): T {
    const p = path.join(this.dictsDir, fileName);
    if (!fs.existsSync(p)) {
      this.logger.warn(`[DictionaryLoader] ${p} 不存在, 使用 BUILTIN_DEFAULTS`);
      return fallback;
    }
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const obj = JSON.parse(txt);
      if (!validator(obj)) {
        this.logger.warn(`[DictionaryLoader] ${p} 结构不合法, 使用 BUILTIN_DEFAULTS`);
        return fallback;
      }
      // 【2026-07-10 阶段 E P0.0】白名单 [1, 2]: v2 扩了 size/geo 分类
      if ((obj as any).version !== 1 && (obj as any).version !== 2) {
        this.logger.warn(
          `[DictionaryLoader] ${p} version=${(obj as any).version} not in [1,2], 使用 BUILTIN_DEFAULTS`,
        );
        return fallback;
      }
      this.jsonLoadedAny = true;
      return obj as T;
    } catch (e: any) {
      this.logger.error(
        `[DictionaryLoader] ${p} 加载失败: ${e?.message || e}, 使用 BUILTIN_DEFAULTS`,
      );
      return fallback;
    }
  }

  /**
   * 【2026-07-14 阶段 E】通用词表加载: 读 JSON, 失败 fallback 默认 Set
   *   schema: { version, description?, weight_hint?, entries: string[] }
   *   与 ai-service/src/comments/dict_loader.py 兼容 (Python 侧可用相同 JSON)
   */
  private _loadWordList(fileName: DictFileName, fallback: Set<string>): Set<string> {
    const p = path.join(this.dictsDir, fileName);
    if (!fs.existsSync(p)) {
      // 启动期 6 个情感词表都属于新增,首次部署时 JSON 不存在是正常场景
      // 仅 debug 级别即可,不刷 warn 噪音
      this.logger.debug?.(`[DictionaryLoader] ${p} 不存在, 使用 BUILTIN_DEFAULTS`);
      return new Set(fallback);
    }
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const obj = JSON.parse(txt);
      if (!obj || !Array.isArray(obj.entries) || obj.entries.length === 0) {
        this.logger.warn(`[DictionaryLoader] ${p} entries 缺失或空, 使用 BUILTIN_DEFAULTS`);
        return new Set(fallback);
      }
      // version 兼容: 数字 (1/2) 或字符串日期 ("2026-07-14")
      const v = obj.version;
      if (typeof v !== 'number' && typeof v !== 'string') {
        this.logger.warn(`[DictionaryLoader] ${p} version=${v} 类型不合法, 使用 BUILTIN_DEFAULTS`);
        return new Set(fallback);
      }
      this.jsonLoadedAny = true;
      return _entriesToSet(obj as WordListDict);
    } catch (e: any) {
      this.logger.error(
        `[DictionaryLoader] ${p} 加载失败: ${e?.message || e}, 使用 BUILTIN_DEFAULTS`,
      );
      return new Set(fallback);
    }
  }
}
