// -*- coding: utf-8 -*-
/**
 * dictionary.loader.ts
 * 阶段 B: 词库外置 + 加载回退 (PR #1)
 *
 * 职责:
 *  - 启动期加载 backend/data/dicts/*.json (5 个分层词库)
 *  - 加载失败 / version 不匹配 → 回退 BUILTIN_DEFAULTS (含原 5 个 Set)
 *  - 暴露 getEntities/getSynonyms/getNegations/getTimeMarkers/getSentimentRules
 *  - 暴露 getBuiltin*() 给 ai-bridge.service 用 (迁出原 5 个 Set 的访问入口)
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

export interface JiebaUserWord {
  word: string;
  weight: number;
}

// ---------------- BUILTIN_DEFAULTS (原 5 个 Set 迁出 + 实体/时间/否定/同义/情感 fallback) ----------------

export const BUILTIN_DEFAULTS = {
  /** 原 ai-bridge.service.ts:26 BLACKLIST_BAD */
  blacklist_bad: new Set<string>(['打死它', '打死', '弄死', '虐待', '傻逼', '智障', '脑残', '废物']),
  /** 原 ai-bridge.service.ts:27 BLACKLIST_FAKE */
  blacklist_fake: new Set<string>(['加微信', '加我微信', '微商', '代购', '纯种', '便宜出', '免费送']),
  /** 原 ai-bridge.service.ts:28 POSITIVE */
  positive: new Set<string>(['可怜', '心疼', '希望', '保佑', '加油', '挺住', '平安', '回家']),
  /** 原 ai-bridge.service.ts:29 REWARD */
  reward: new Set<string>(['找到', '谢谢', '感谢', '已找回', '团聚']),
  /** 原 ai-bridge.service.ts:30 REPORT */
  report: new Set<string>(['看到', '见到', '目击', '刚发现']),

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

const DICT_FILES = ['entities.json', 'synonyms.json', 'negations.json', 'time-markers.json', 'sentiment-rules.json'] as const;
type DictFileName = (typeof DICT_FILES)[number];

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

  /** 全量加载 5 个 JSON, 失败各自回退 BUILTIN_DEFAULTS */
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

    const entCount = Object.values(this.entities.categories).reduce(
      (s, c) => s + (Array.isArray(c.words) ? c.words.length : 0),
      0,
    );
    this.logger.log(
      `[DictionaryLoader.loadAll] dir=${this.dictsDir} ` +
        `entities_words=${entCount} synonyms_groups=${this.synonyms.groups.length} ` +
        `negations=${this.negations.words.length} time_markers=${this.timeMarkers.markers.length} ` +
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

  // ---------------- BUILTIN_DEFAULTS 访问入口 (供 ai-bridge.service 用, 替代原 5 个 Set) ----------------

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
      if ((obj as any).version !== 1) {
        this.logger.warn(
          `[DictionaryLoader] ${p} version=${(obj as any).version} != 1, 使用 BUILTIN_DEFAULTS`,
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
}
