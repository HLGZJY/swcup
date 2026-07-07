// -*- coding: utf-8 -*-
/**
 * clue-bridge.service.ts
 * Ã¨Â¯â€žÃ¨Â®Âº -> clue_matcher Ã¦Â¡Â¥Ã¦Å½Â¥Ã¥Â±â€š (P3 Ã©â€”Â­Ã§Å½Â¯ 2026-07-07)
 *
 * Ã¨Â®Â¾Ã¨Â®Â¡:
 * - Ã¥Ë†â€¡Ã¨Â¯Â: nodejieba Ã¤Â¼ËœÃ¥â€¦Ë† -> segmentit -> Ã¤Â¸Â­Ã¦â€“â€¡ 2~6 Ã¥Â­â€”Ã¦Â»â€˜Ã¥Å Â¨Ã§Âªâ€”Ã¥ÂÂ£Ã¥â€¦Å“Ã¥Âºâ€¢
 * - matcher: Ã§Â®â€”Ã¦Â³â€¢Ã§Â§Â»Ã¦Â¤ÂÃ¨â€¡Âª ai-service/comments/clue_matcher.py (Ã¥ÂÅ½Ã§Â«Â¯Ã¨â€¡ÂªÃ§Â®Â¡, Ã¤Â¸ÂÃ¨Â·Â¨Ã¨Â¿â€ºÃ§Â¨â€¹)
 * - Ã¨ÂÂ½Ã§â€ºËœ: backend/data/clue_state/<animal_id>.json
 *
 * Ã¦â€Â¹Ã¥Å Â¨Ã¦â€”Â¶Ã¥Â¿â€¦Ã©Â¡Â»Ã¥ÂÅ’Ã¦Â­Â¥ ai-service Ã§Â«Â¯Ã¥ÂÅ’Ã¥ÂÂÃ¥â€¡Â½Ã¦â€¢Â° (Ã¤Â¸Â¤Ã¨Â¾Â¹Ã©Æ’Â½Ã¨Â¦ÂÃ¦â€ºÂ´Ã¦â€“Â°Ã¥Ââ€¢Ã¦Âµâ€¹).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

// ---------------- Ã¥Ë†â€¡Ã¨Â¯ÂÃ¥â„¢Â¨ (3 Ã¦Â¡Â£Ã©â„¢ÂÃ§ÂºÂ§) ----------------

type Segmenter = {
  cut(content: string): string[];
};

function makeNodeJiebaSegmenter(): Segmenter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jieba = require('nodejieba');
    // 立即探测 native binding：用中文句子切，必须切出 >=1 个 2+字中文词
    try {
      const probeRaw = jieba.cut('我在朝阳公园看到一只金毛', true);
      if (!Array.isArray(probeRaw)) return null;
      const probe = probeRaw.filter((w: string) => w && w.length >= 2 && /[\u4e00-\u9fa5]/.test(w));
      if (probe.length === 0) return null;
    } catch {
      return null; // native binding 缺失或中文切词异常
    }
    return {
      cut(content: string): string[] {
        const raw = jieba.cut(content || '', true);
        return raw.filter(
          (w: string) => w && w.length >= 2 && !/^\d+$/.test(w) && !/^[a-zA-Z]+$/.test(w),
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
    } else if (segit.default && typeof segit.default.useDefault === 'function') {
      seg = segit.default.useDefault(new segit.default.Segment());
    } else {
      seg = new segit.Segment();
    }
    return {
      cut(content: string): string[] {
        const input = Array.isArray(content) ? content.join(' ') : (content || '');
        let tokens: any[];
        try {
          tokens = seg.doSegment(input, { stripPunctuation: true });
        } catch {
          tokens = seg.doSegment(input);
        }
        return tokens
          .map((t: any) => (t && (t.w || t)) || '')
          .filter((w: string) => typeof w === 'string' && w.length >= 2 && !/^\d+$/.test(w));
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

// ---------------- Matcher Ã§Â®â€”Ã¦Â³â€¢ (Ã§Â§Â»Ã¦Â¤ÂÃ¨â€¡Âª ai-service/comments/clue_matcher.py) ----------------

interface ScoreOut { score: number; reasons: string[]; }

const TRIGGER_SENTIMENTS = new Set(['report', 'seek']);
const CLUE_THRESHOLD = 0.5;

function _matchId(commentId: string, animalId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const c = require('crypto');
  return c.createHash('sha256').update((commentId || '') + '|' + (animalId || ''), 'utf8').digest('hex').slice(0, 16);
}

function _parseIso(s: string): number {
  if (!s) return 0;
  let v = s;
  if (v.endsWith('Z')) v = v.slice(0, -1) + '+00:00';
  return new Date(v).getTime() / 1000;
}

function _score(comment: any, event: any): ScoreOut {
  let score = 0;
  const reasons: string[] = [];

  const sentiment = comment.sentiment || '';
  if (sentiment === 'report') {
    score += 0.5;
    reasons.push('sentiment=report:+0.5');
  } else if (sentiment === 'seek') {
    score += 0.4;
    reasons.push('sentiment=seek:+0.4');
  }

  const kws: string[] = Array.isArray(comment.keywords) ? comment.keywords : [];
  const kwsSet = new Set(kws.filter((k) => k && typeof k === 'string'));
  const addr = String(event.address || '').trim();
  if (kwsSet.size > 0 && addr) {
    let hits = 0;
    for (const k of kwsSet) if (addr.indexOf(k) >= 0) hits++;
    if (hits > 0) {
      const add = Math.min(0.3, 0.1 * hits);
      score += add;
      reasons.push('kw_in_addr:' + hits + ':+' + add.toFixed(3));
    }
  }

  const desc = String(event.description || '').trim();
  if (kwsSet.size > 0 && desc) {
    let hits = 0;
    for (const k of kwsSet) if (desc.indexOf(k) >= 0) hits++;
    if (hits > 0) {
      const add = Math.min(0.2, 0.05 * hits);
      score += add;
      reasons.push('kw_in_desc:' + hits + ':+' + add.toFixed(3));
    }
  }

  const co = comment.created_at || '';
  const eo = event.occurred_at || '';
  try {
    if (co && eo) {
      const dt = Math.abs(_parseIso(co) - _parseIso(eo));
      if (dt <= 3600 * 24 * 3) {
        const bonus = Math.max(0, 0.15 * (1 - dt / (3600 * 24 * 7)));
        score += bonus;
        reasons.push('time_close:delta_sec=' + Math.floor(dt) + ':+' + bonus.toFixed(3));
      }
    }
  } catch { /* ignore */ }

  return { score: Math.min(1, score), reasons };
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

function _tryMatch(comment: any, recentEvents: any[], stateDir: string): MatchOut {
  const animalId = comment.animal_id || '';
  const reporterId = comment.reporter_id || '';
  const sentiment = comment.sentiment || '';
  const content = String(comment.content || '').trim();
  const matchId = _matchId(comment.comment_id || '', animalId);

  const base: Omit<MatchOut, 'candidate_event_id' | 'candidate_event_reporter_id' | 'candidate_event_address' | 'match_score' | 'match_reasons' | 'status' | 'state_path'> = {
    match_id: matchId,
    comment_id: comment.comment_id || '',
    animal_id: animalId,
    comment_reporter_id: reporterId,
    sentiment,
    keywords: Array.isArray(comment.keywords) ? comment.keywords : [],
    created_at: comment.created_at || '',
  };

  if (!content || !TRIGGER_SENTIMENTS.has(sentiment)) {
    return { ...base, candidate_event_id: '', candidate_event_reporter_id: '', candidate_event_address: '', match_score: 0, match_reasons: [], status: 'no_match', state_path: '' };
  }
  if (!Array.isArray(recentEvents) || recentEvents.length === 0) {
    return { ...base, candidate_event_id: '', candidate_event_reporter_id: '', candidate_event_address: '', match_score: 0, match_reasons: [], status: 'no_match', state_path: '' };
  }

  let bestEvent: any = null;
  let bestScore = 0;
  let bestReasons: string[] = [];
  for (const ev of recentEvents) {
    const r = _score(comment, ev);
    if (r.score > bestScore) {
      bestEvent = ev;
      bestScore = r.score;
      bestReasons = r.reasons;
    }
  }

  if (!bestEvent || bestScore < CLUE_THRESHOLD) {
    return { ...base, candidate_event_id: '', candidate_event_reporter_id: '', candidate_event_address: '', match_score: 0, match_reasons: [], status: 'no_match', state_path: '' };
  }

  if (bestEvent.reporter_id === reporterId) {
    return { ...base, candidate_event_id: '', candidate_event_reporter_id: '', candidate_event_address: '', match_score: 0, match_reasons: [], status: 'self_match', state_path: '' };
  }

  fs.mkdirSync(stateDir, { recursive: true });
  const safeAid = animalId.replace(/[\\/]/g, '_');
  const statePath = path.join(stateDir, safeAid + '.json');
  const list = _loadState(statePath);
  list.push({
    match_id: matchId,
    comment_id: comment.comment_id || '',
    animal_id: animalId,
    comment_reporter_id: reporterId,
    sentiment,
    keywords: Array.isArray(comment.keywords) ? comment.keywords : [],
    created_at: comment.created_at || '',
    candidate_event_id: bestEvent.event_id || '',
    candidate_event_reporter_id: bestEvent.reporter_id || '',
    candidate_event_address: bestEvent.address || '',
    match_score: Math.round(bestScore * 10000) / 10000,
    match_reasons: bestReasons,
    status: 'pending',
    recorded_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  });
  _saveState(statePath, list);

  return {
    ...base,
    candidate_event_id: bestEvent.event_id || '',
    candidate_event_reporter_id: bestEvent.reporter_id || '',
    candidate_event_address: bestEvent.address || '',
    match_score: Math.round(bestScore * 10000) / 10000,
    match_reasons: bestReasons,
    status: 'pending',
    state_path: statePath,
  };
}

function _loadState(p: string): any[] {
  if (!fs.existsSync(p)) return [];
  try {
    const txt = fs.readFileSync(p, 'utf8');
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _saveState(p: string, list: any[]): void {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function _listPending(stateDir: string): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  if (!fs.existsSync(stateDir)) return out;
  for (const name of fs.readdirSync(stateDir).sort()) {
    if (!name.endsWith('.json')) continue;
    const p = path.join(stateDir, name);
    const recs = _loadState(p);
    const pending = recs.filter((r) => r.status === 'pending');
    if (pending.length > 0) out[name.slice(0, -5)] = pending;
  }
  return out;
}

function _decide(stateDir: string, matchId: string, animalId: string, decision: 'confirmed' | 'rejected', note: string, adminId: string): boolean {
  if (!matchId || !animalId) return false;
  const safeAid = animalId.replace(/[\\/]/g, '_');
  const p = path.join(stateDir, safeAid + '.json');
  const list = _loadState(p);
  let changed = false;
  for (const r of list) {
    if (r.match_id === matchId && r.status === 'pending') {
      r.status = decision;
      r.decided_by = adminId || '';
      r.decided_at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      r.decision_note = note || '';
      changed = true;
      break;
    }
  }
  if (changed) _saveState(p, list);
  return changed;
}

// ---------------- ClueBridgeService Ã¤Â¸Â»Ã§Â±Â» ----------------

@Injectable()
export class ClueBridgeService {
  private readonly logger = new Logger(ClueBridgeService.name);
  private segmenter!: Segmenter;
  private segmenterKind: 'nodejieba' | 'segmentit' | 'fallback' = 'fallback';
  private stateDir: string;

  constructor(private readonly cfg: ConfigService) {
    this.stateDir = this.cfg.get<string>('CLUE_STATE_DIR') || path.join(process.cwd(), 'data', 'clue_state');
  }

  init(): void {
    const j = makeNodeJiebaSegmenter();
    if (j) {
      this.segmenter = j;
      this.segmenterKind = 'nodejieba';
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
    fs.mkdirSync(this.stateDir, { recursive: true });
    this.logger.log('[ClueBridgeService.init] segmenter=' + this.segmenterKind + ', state_dir=' + this.stateDir);
  }

  /** Ã§Â»â„¢Ã¥Ââ€¢Ã¦ÂÂ¡Ã¨Â¯â€žÃ¨Â®ÂºÃ¦Å Â½Ã¥Ââ€“Ã¥â€¦Â³Ã©â€Â®Ã¨Â¯Â (8 Ã¤Â¸ÂªÃ¤Â¸Å Ã©â„¢Â) */
  extractKeywords(content: string): string[] {
    const tokens = this.segmenter.cut(content || '');
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

  /** Ã¤Â¸Â»Ã¥â€¦Â¥Ã¥ÂÂ£ */
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
    const kws = this.extractKeywords(comment.content);
    return _tryMatch({ ...comment, keywords: kws }, recentEvents, this.stateDir);
  }

  listPending(): Record<string, any[]> {
    return _listPending(this.stateDir);
  }

  decide(matchId: string, animalId: string, decision: 'confirmed' | 'rejected', note: string, adminId: string): boolean {
    return _decide(this.stateDir, matchId, animalId, decision, note, adminId);
  }

  static _score(comment: any, event: any): ScoreOut { return _score(comment, event); }
  static _matchId(commentId: string, animalId: string): string { return _matchId(commentId, animalId); }

  getStateDir(): string { return this.stateDir; }
  getSegmenterKind(): 'nodejieba' | 'segmentit' | 'fallback' { return this.segmenterKind; }
}