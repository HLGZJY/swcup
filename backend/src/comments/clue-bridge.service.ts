// -*- coding: utf-8 -*-
/**
 * clue-bridge.service.ts
 * 评论 -> clue_matcher 桥接 (P3 闭环 2026-07-07)
 *
 * 【2026-07-09 阶段 C】重构:
 *   - 落盘迁出: FileStateStore (proper-lockfile + .bak + tmp+fsync+rename)
 *   - 事件召回迁出: EventRecallService (两步召回)
 *   - 评分公式: sentiment + entity加权 + synonym兜底 + negation惩罚 + time_decay + self_match惩罚
 *   - match_id: 新格式含 eventId, 旧值存 match_id_v1
 *
 * 设计:
 *   - 分词: nodejieba -> segmentit -> 滑动窗口 2-6 字 (3 档降级)
 *   - matcher: 公式移植自 ai-service/comments/clue_matcher.py (后端自治, 不跨进程)
 *   - 落盘: backend/data/clue_state/<animal_id>.json (由 FileStateStore 接管)
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

import { Comment } from './entities/comment.entity';
import { Animal } from '../animals/entities/animal.entity';
import {
  RescueEvent,
  EventType,
  EventSource,
  EventStatus,
} from '../events/entities/event.entity';
import { DictionaryLoader } from './dictionary.loader';
import { FileStateStore, MatchRecord, newMatchId } from './file-state-store';
import { DEFAULT_RULES, ScoringRules } from './scoring-rules';

// ---------------- 分词器 (3 档降级) ----------------

type Segmenter = {
  cut(content: string): string[];
};

function makeNodeJiebaSegmenter(): Segmenter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jieba = require('nodejieba');
    try {
      const probeRaw = jieba.cut('我在朝阳公园看到一只金毛', true);
      if (!Array.isArray(probeRaw)) return null;
      const probe = probeRaw.filter(
        (w: string) => w && w.length >= 2 && /[\u4e00-\u9fa5]/.test(w),
      );
      if (probe.length === 0) return null;
    } catch {
      return null;
    }
    return {
      cut(content: string): string[] {
        const raw = jieba.cut(content || '', true);
        return raw.filter(
          (w: string) =>
            w && w.length >= 2 && !/^\d+$/.test(w) && !/^[a-zA-Z]+$/.test(w),
        );
      },
    };
  } catch {
    return null;
  }
}

function makeSegmentitSegmenter(): Segmenter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const segit = require('segmentit');
    let seg: any;
    if (typeof segit.useDefault === 'function') {
      seg = segit.useDefault(new segit.Segment());
    } else if (
      segit.default &&
      typeof segit.default.useDefault === 'function'
    ) {
      seg = segit.default.useDefault(new segit.default.Segment());
    } else {
      seg = new segit.Segment();
    }
    return {
      cut(content: string): string[] {
        const input = Array.isArray(content) ? content.join(' ') : content || '';
        let tokens: any[];
        try {
          tokens = seg.doSegment(input, { stripPunctuation: true });
        } catch {
          tokens = seg.doSegment(input);
        }
        return tokens
          .map((t: any) => (t && (t.w || t)) || '')
          .filter(
            (w: string) => typeof w === 'string' && w.length >= 2 && !/^\d+$/.test(w),
          );
      },
    };
  } catch {
    return null;
  }
}

function makeSlidingWindowSegmenter(): Segmenter {
  return {
    cut(content: string): string[] {
      const cjk = (content || '').match(/[\u4e00-\u9fa5]{2,6}/g) || [];
      return Array.from(new Set(cjk));
    },
  };
}

// ---------------- 评分 (新公式, 阶段 C) ----------------

const TRIGGER_SENTIMENTS = new Set(['report', 'seek']);

interface ScoreOut {
  score: number;
  reasons: string[];
}

interface CommentLike {
  comment_id?: string;
  animal_id?: string;
  content?: string;
  reporter_id?: string;
  sentiment?: string;
  keywords?: string[];
  tokens?: string[];
  created_at?: string;
}

interface EventLike {
  event_id?: string;
  event_type?: string;
  reporter_id?: string;
  occurred_at?: string;
  address?: string;
  description?: string;
}

function _parseIso(s: string): number {
  if (!s) return 0;
  let v = s;
  if (v.endsWith('Z')) v = v.slice(0, -1) + '+00:00';
  return new Date(v).getTime() / 1000;
}

/**
 * 实体命中: 评论 raw content 与 eventText (address+description) 中共同出现的 entity 词
 *  - 使用 raw 子串匹配, 避免 CJK 分词贪婪合并导致原子词被吞
 *  - 返回 [{ word, category, weight }]
 */
function matchEntity(
  commentText: string,
  eventText: string,
  entities: { categories: Record<string, { weight: number; words: string[] }> },
): Array<{ word: string; category: string; weight: number }> {
  const hits: Array<{ word: string; category: string; weight: number }> = [];
  if (!eventText || !commentText) return hits;
  for (const [catName, cat] of Object.entries(entities.categories || {})) {
    if (!cat || !Array.isArray(cat.words)) continue;
    for (const w of cat.words) {
      if (!w) continue;
      if (commentText.indexOf(w) >= 0 && eventText.indexOf(w) >= 0) {
        hits.push({ word: w, category: catName, weight: cat.weight || 0 });
      }
    }
  }
  return hits;
}

/**
 * 同义词命中: 检查评论 token 是否为某 canonical/aliases, 且 address 中含 canonical
 * 仅在 entity 0 命中时使用
 */
function matchSynonym(
  tokens: string[],
  eventText: string,
  synonyms: { groups: Array<{ canonical: string; aliases: string[] }> },
): string | null {
  if (!eventText || !Array.isArray(tokens) || tokens.length === 0) return null;
  const tokenSet = new Set(tokens);
  for (const g of synonyms.groups || []) {
    if (!g || !g.canonical) continue;
    if (tokenSet.has(g.canonical) && eventText.indexOf(g.canonical) >= 0) {
      return g.canonical;
    }
  }
  return null;
}

/**
 * 否定窗口: 评论 content 中出现否定词 (使用 raw content + token 集合)
 */
function matchNegation(
  content: string,
  tokens: string[],
  negations: { words: string[] },
): boolean {
  if (!content) return false;
  const c = String(content);
  for (const w of negations.words || []) {
    if (!w) continue;
    if (c.indexOf(w) >= 0) return true;
  }
  return false;
}

/**
 * 新版 _score (阶段 C):
 *   score = sentiment_base
 *         + min(entityMax, sum_entity_weight)
 *         + (entity_hits==0 && synonym ? synonymBonus : 0)
 *         - (negation && entity_hits==0 ? negationPenalty : 0)
 *         + time_decay_bonus (0 if dt > timeWindowDays)
 *         - (self_match ? selfMatchPenalty : 0)
 *   final = clamp(0, 1, score)
 */
function _score(
  comment: CommentLike,
  event: EventLike,
  rules: ScoringRules,
  dicts: {
    entities: any;
    synonyms: any;
    negations: any;
  },
): ScoreOut {
  const reasons: string[] = [];
  let score = 0;

  // 1) sentiment 基础分
  const sent = comment.sentiment || '';
  if (sent === 'report') {
    score += rules.sentiment.report;
    reasons.push('sentiment=report:+' + rules.sentiment.report);
  } else if (sent === 'seek') {
    score += rules.sentiment.seek;
    reasons.push('sentiment=seek:+' + rules.sentiment.seek);
  }

  const tokens: string[] = Array.isArray(comment.tokens)
    ? comment.tokens
    : Array.isArray(comment.keywords)
    ? comment.keywords
    : [];
  const eventText =
    String(event.address || '') + ' ' + String(event.description || '');

  // 2) 实体命中分层加权 (用 raw content 子串匹配, 避免 CJK 分词吞词)
  const entityHits = matchEntity(String(comment.content || ''), eventText, dicts.entities);
  if (entityHits.length > 0) {
    const sum = entityHits.reduce((s, h) => s + (h.weight || 0), 0);
    const add = Math.min(rules.entityMax, sum);
    score += add;
    reasons.push(
      'entity_hits=' +
        entityHits.length +
        ':words=' +
        entityHits.map((h) => h.word).join(',') +
        ':+' +
        add.toFixed(3),
    );
  }

  // 3) 同义词兜底 (仅实体未命中)
  if (entityHits.length === 0) {
    const syn = matchSynonym(tokens, String(event.address || ''), dicts.synonyms);
    if (syn) {
      score += rules.synonymBonus;
      reasons.push('synonym=' + syn + ':+' + rules.synonymBonus);
    }
  }

  // 4) 否定窗口扣分
  const negHit = matchNegation(
    comment.content || '',
    tokens,
    dicts.negations,
  );
  if (negHit && entityHits.length === 0) {
    score -= rules.negationPenalty;
    reasons.push('negation_window:-' + rules.negationPenalty);
  }

  // 5) 时间衰减
  try {
    const co = comment.created_at || '';
    const eo = event.occurred_at || '';
    if (co && eo) {
      const dtSec = Math.abs(_parseIso(co) - _parseIso(eo));
      const dtDays = dtSec / 86400;
      if (dtDays < rules.timeWindowDays) {
        const tbonus = Math.max(
          0,
          rules.timeDecayPeak * (1 - dtDays / rules.timeWindowDays),
        );
        score += tbonus;
        reasons.push(
          'time_close:days=' + dtDays.toFixed(1) + ':+' + tbonus.toFixed(3),
        );
      }
    }
  } catch {
    /* ignore */
  }

  // 6) 自匹配扣分
  if (
    event.reporter_id &&
    comment.reporter_id &&
    event.reporter_id === comment.reporter_id
  ) {
    score -= rules.selfMatchPenalty;
    reasons.push('self_match:-' + rules.selfMatchPenalty);
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

export interface MatchOut {
  match_id: string;
  comment_id: string;
  animal_id: string;
  comment_reporter_id: string;
  sentiment: string;
  keywords: string[];
  created_at: string;
  candidate_event_id: string;
  candidate_event_reporter_id: string;
  candidate_event_address: string;
  match_score: number;
  match_reasons: string[];
  status: 'pending' | 'no_match' | 'self_match' | 'cooldown';
  state_path: string;
}

interface MatchInputComment {
  comment_id: string;
  animal_id: string;
  content: string;
  reporter_id: string;
  sentiment: string;
  created_at: string;
}

interface MatchInputEvent {
  event_id: string;
  event_type: string;
  reporter_id: string;
  occurred_at: string;
  address?: string;
  description?: string;
}

function _tryMatch(
  comment: MatchInputComment,
  recentEvents: MatchInputEvent[],
  rules: ScoringRules,
  dicts: { entities: any; synonyms: any; negations: any },
  store: FileStateStore,
): MatchOut {
  const animalId = comment.animal_id || '';
  const reporterId = comment.reporter_id || '';
  const sentiment = comment.sentiment || '';
  const content = String(comment.content || '').trim();
  const kws = extractKeywordsFromTokens(_tokenizeForMatch(comment.content));

  const base: Omit<
    MatchOut,
    | 'candidate_event_id'
    | 'candidate_event_reporter_id'
    | 'candidate_event_address'
    | 'match_score'
    | 'match_reasons'
    | 'status'
    | 'state_path'
  > = {
    match_id: '', // pending 时填
    comment_id: comment.comment_id || '',
    animal_id: animalId,
    comment_reporter_id: reporterId,
    sentiment,
    keywords: kws,
    created_at: comment.created_at || '',
  };

  if (!content || !TRIGGER_SENTIMENTS.has(sentiment)) {
    return {
      ...base,
      candidate_event_id: '',
      candidate_event_reporter_id: '',
      candidate_event_address: '',
      match_score: 0,
      match_reasons: [],
      status: 'no_match',
      state_path: '',
    };
  }
  if (!Array.isArray(recentEvents) || recentEvents.length === 0) {
    return {
      ...base,
      candidate_event_id: '',
      candidate_event_reporter_id: '',
      candidate_event_address: '',
      match_score: 0,
      match_reasons: [],
      status: 'no_match',
      state_path: '',
    };
  }

  // 评分 + 选 best (排除 reporter == self 的事件 — 自匹配在 score 里已经惩罚, 这里直接排除避免 pending)
  const tokens = _tokenizeForMatch(content);
  const commentForScore: CommentLike = {
    ...comment,
    tokens,
    keywords: kws,
  };

  let bestEvent: MatchInputEvent | null = null;
  let bestScore = 0;
  let bestReasons: string[] = [];
  for (const ev of recentEvents) {
    if (!ev || !ev.event_id) continue;
    const r = _score(commentForScore, ev, rules, dicts);
    if (r.score > bestScore) {
      bestEvent = ev;
      bestScore = r.score;
      bestReasons = r.reasons;
    }
  }

  if (!bestEvent) {
    return {
      ...base,
      candidate_event_id: '',
      candidate_event_reporter_id: '',
      candidate_event_address: '',
      match_score: 0,
      match_reasons: [],
      status: 'no_match',
      state_path: '',
    };
  }

  // 自匹配特殊状态: 在 score 已有 -0.3 惩罚 (排序), 这里再给 status=self_match (不入库)
  if (bestEvent.reporter_id && bestEvent.reporter_id === reporterId) {
    return {
      ...base,
      candidate_event_id: '',
      candidate_event_reporter_id: '',
      candidate_event_address: '',
      match_score: 0,
      match_reasons: [],
      status: 'self_match',
      state_path: '',
    };
  }

  if (bestScore < rules.threshold) {
    return {
      ...base,
      candidate_event_id: '',
      candidate_event_reporter_id: '',
      candidate_event_address: '',
      match_score: 0,
      match_reasons: [],
      status: 'no_match',
      state_path: '',
    };
  }

  const matchId = newMatchId(
    comment.comment_id || '',
    animalId,
    bestEvent.event_id,
    sentiment,
  );
  const statePath = ''; // store 内部管理, 不再暴露

  const rec: MatchRecord = {
    match_id: matchId,
    comment_id: comment.comment_id || '',
    animal_id: animalId,
    comment_reporter_id: reporterId,
    sentiment,
    keywords: kws,
    created_at: comment.created_at || '',
    candidate_event_id: bestEvent.event_id,
    candidate_event_reporter_id: bestEvent.reporter_id || '',
    candidate_event_address: bestEvent.address || '',
    match_score: Math.round(bestScore * 10000) / 10000,
    match_reasons: bestReasons,
    status: 'pending',
    recorded_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    schema_version: 2,
  };

  // 同步落盘 (sync write, 保证 listPending() 立即可见)
  try {
    store.appendSync(animalId, rec);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn(
      '[ClueBridgeService._tryMatch] FileStateStore.appendSync failed: ' +
        (e?.message || e),
    );
  }

  return {
    ...base,
    match_id: matchId,
    candidate_event_id: bestEvent.event_id,
    candidate_event_reporter_id: bestEvent.reporter_id || '',
    candidate_event_address: bestEvent.address || '',
    match_score: Math.round(bestScore * 10000) / 10000,
    match_reasons: bestReasons,
    status: 'pending',
    state_path: statePath,
  };
}

function _tokenizeForMatch(content: string): string[] {
  // 简单 token 提取 (用于 entity / synonym / negation)
  // 取 CJK 2-6 字 + 英文词, 与 SlidingWindow 兼容
  const cjk = (content || '').match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const en = (content || '').match(/[a-zA-Z]{2,}/g) || [];
  return Array.from(new Set([...cjk, ...en].map((s) => s.toLowerCase())));
}

function extractKeywordsFromTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

// ---------------- ClueBridgeService 主类 ----------------

@Injectable()
export class ClueBridgeService {
  private readonly logger = new Logger(ClueBridgeService.name);
  private segmenter!: Segmenter;
  private segmenterKind: 'nodejieba' | 'segmentit' | 'fallback' = 'fallback';
  private rules: ScoringRules = DEFAULT_RULES;

  constructor(
    private readonly cfg: ConfigService,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    @Optional() @InjectRepository(RescueEvent) private readonly eventRepo?: Repository<RescueEvent>,
    private readonly dict: DictionaryLoader = new DictionaryLoader(cfg),
    private readonly store: FileStateStore = new FileStateStore(cfg),
  ) {}

  init(): void {
    // 分词器初始化 (3 档降级)
    const j = makeNodeJiebaSegmenter();
    if (j) {
      this.segmenter = j;
      this.segmenterKind = 'nodejieba';
      // 阶段 B: 把 DictionaryLoader 的 entities + synonyms.canonical 注入 jieba 业务词
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const jieba = require('nodejieba');
        const userWords = this.dict.getJiebaUserWords();
        let injected = 0;
        for (const { word } of userWords) {
          try {
            jieba.insertWord(word);
            injected++;
          } catch {
            /* 重复注入 ignore */
          }
        }
        this.logger.log(
          '[ClueBridgeService.init] jieba user_dict injected: ' + injected + ' words',
        );
      } catch (e: any) {
        this.logger.warn(
          '[ClueBridgeService.init] jieba.injectWord 失败 (非阻塞): ' +
            (e?.message || String(e)),
        );
      }
    } else {
      const s = makeSegmentitSegmenter();
      if (s) {
        this.segmenter = s;
        this.segmenterKind = 'segmentit';
      } else {
        this.segmenter = makeSlidingWindowSegmenter();
        this.segmenterKind = 'fallback';
      }
    }
    // FileStateStore 已自动 onModuleInit
    fs.mkdirSync(this.store.getStateDir(), { recursive: true });
    this.logger.log(
      '[ClueBridgeService.init] segmenter=' +
        this.segmenterKind +
        ', state_dir=' +
        this.store.getStateDir(),
    );
  }

  /** 主入口: 评分 + 选 best + 落盘 */
  matchComment(
    comment: {
      comment_id: string;
      animal_id: string;
      content: string;
      reporter_id: string;
      sentiment: string;
      created_at: string;
    },
    recentEvents: Array<{
      event_id: string;
      event_type: string;
      reporter_id: string;
      occurred_at: string;
      address?: string;
      description?: string;
    }>,
  ): MatchOut {
    const dicts = {
      entities: this.dict.getEntities(),
      synonyms: this.dict.getSynonyms(),
      negations: this.dict.getNegations(),
    };
    return _tryMatch(comment, recentEvents, this.rules, dicts, this.store);
  }

  listPending(): Record<string, MatchRecord[]> {
    // 同步 fire-and-forget 不太合适, 改为 sync 包装
    // FileStateStore.listAllPending() 是 async, 这里包装为 sync (实际 await)
    // 由于 Nest 调用方都是 async, 改 listPendingAsync 暴露, 这里保留旧 API
    return this._listPendingSync();
  }

  private _listPendingSync(): Record<string, MatchRecord[]> {
    try {
      // 同步读 + 过滤 pending
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');
      const fsSync = require('fs') as typeof fs;
      const stateDir = this.store.getStateDir();
      const out: Record<string, MatchRecord[]> = {};
      if (!fsSync.existsSync(stateDir)) return out;
      for (const name of fsSync.readdirSync(stateDir).sort()) {
        if (!name.endsWith('.json') || name.startsWith('_')) continue;
        const p = path.join(stateDir, name);
        let list: any[] = [];
        try {
          list = JSON.parse(fsSync.readFileSync(p, 'utf8'));
        } catch {
          continue;
        }
        const pending = (list as MatchRecord[]).filter(
          (r) => r && r.status === 'pending',
        );
        if (pending.length > 0) out[name.slice(0, -5)] = pending;
      }
      return out;
    } catch {
      return {};
    }
  }

  /**
   * 决策一条线索 (阶段 A 落库 + 阶段 C store 替代)
   *  1) FileStateStore.update 改 status
   *  2) confirmed 时 额外触发 3 个 DB 副作用:
   *      ① INSERT rescue_event (source=CLUE, status=CONFIRMED)
   *      ② UPDATE animals.last_seen_at / last_seen_address
   *      ③ UPDATE comments.is_clue_confirmed / clue_confirmed_animal_id
   */
  async decide(
    matchId: string,
    animalId: string,
    decision: 'confirmed' | 'rejected',
    note: string,
    adminId: string,
  ): Promise<{ ok: boolean; persisted?: boolean }> {
    if (!matchId || !animalId) return { ok: false };
    const patch: Partial<MatchRecord> = {
      status: decision,
      decided_by: adminId || '',
      decided_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      decision_note: note || '',
    };
    const ok = await this.store.update(animalId, matchId, patch);
    if (!ok || decision !== 'confirmed') {
      return { ok };
    }
    try {
      const persisted = await this._persistConfirm(matchId, animalId);
      return { ok, persisted };
    } catch (e: any) {
      this.logger.error(
        `[ClueBridgeService.decide] _persistConfirm 失败, match_id=${matchId} animal_id=${animalId}: ${e?.message || e}`,
      );
      return { ok, persisted: false };
    }
  }

  private async _persistConfirm(matchId: string, animalId: string): Promise<boolean> {
    const list = await this.store.loadList(animalId);
    const rec = list.find((r) => r.match_id === matchId && r.status === 'confirmed');
    if (!rec) {
      this.logger.warn(
        `[_persistConfirm] 找不到 status=confirmed 的记录, match_id=${matchId}, animal_id=${animalId}`,
      );
      return false;
    }

    const eventId = randomUUID();
    const now = new Date();

    let lat = 0;
    let lng = 0;
    const animal = await this.animalRepo.findOne({ where: { animal_id: animalId } });
    if (animal) {
      lat = Number(animal.location_lat) || 0;
      lng = Number(animal.location_lng) || 0;
    }

    const address =
      rec.candidate_event_address ||
      (animal && (animal as any).address) ||
      null;

    if (this.eventRepo) {
      await this.eventRepo.save({
        event_id: eventId,
        animal_id: animalId,
        event_type: EventType.REPORT,
        source: EventSource.CLUE,
        reporter_id: rec.comment_reporter_id || null,
        occurred_at: now,
        location_lat: lat,
        location_lng: lng,
        address,
        description: `线索确认关联,基于评论 ${rec.comment_id || ''}`.slice(0, 500),
        status: EventStatus.CONFIRMED,
      } as Partial<RescueEvent>);
    }

    await this.animalRepo.update(
      { animal_id: animalId },
      {
        last_seen_at: now,
        address: address || undefined,
      } as Partial<Animal>,
    );

    if (rec.comment_id) {
      await this.commentRepo.update(
        { comment_id: rec.comment_id },
        {
          is_clue_confirmed: true,
          clue_confirmed_animal_id: animalId,
        } as Partial<Comment>,
      );
    }

    this.logger.log(
      `[_persistConfirm] OK match_id=${matchId} -> event_id=${eventId} for animal ${animalId}`,
    );
    return true;
  }

  /** 静态评分暴露 (供测试 / admin dry-run) */
  static score(
    comment: CommentLike,
    event: EventLike,
    rules: ScoringRules = DEFAULT_RULES,
    dicts?: { entities: any; synonyms: any; negations: any },
  ): ScoreOut {
    return _score(comment, event, rules, dicts || defaultDictsForTest());
  }

  getStateDir(): string {
    return this.store.getStateDir();
  }
  getSegmenterKind(): 'nodejieba' | 'segmentit' | 'fallback' {
    return this.segmenterKind;
  }
  getRules(): ScoringRules {
    return this.rules;
  }
}

function defaultDictsForTest(): { entities: any; synonyms: any; negations: any } {
  return {
    entities: { categories: { breed: { weight: 0.2, words: [] } } },
    synonyms: { groups: [] },
    negations: { words: ['不是', '没有', '没'] },
  };
}
