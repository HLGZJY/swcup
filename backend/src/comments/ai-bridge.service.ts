// -*- coding: utf-8 -*-

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Comment, CommentSentiment } from './entities/comment.entity';



export interface ModerateReason { layer: string; detail: string; }
export interface ModerateResult {
  verdict: 'allow' | 'hide' | 'review';
  suggested_action: 'allow' | 'hide' | 'needs_review';
  reasons: ModerateReason[];
  primary_sentiment: CommentSentiment;
  is_hidden: boolean;
}
export interface CommentSummary {
  total: number;
  sentiment_dist: Record<string, number>;
  top_keywords: string[];
  auto_summary: string;
}

const BLACKLIST_BAD = new Set(['打死它','打死','弄死','虐待','傻逼','智障','脑残','废物']);
const BLACKLIST_FAKE = new Set(['加微信','加我微信','微商','代购','纯种','便宜出','免费送']);
const POSITIVE = new Set(['可怜','心疼','希望','保佑','加油','挺住','平安','回家']);
const REWARD = new Set(['找到','谢谢','感谢','已找回','团聚']);
const REPORT = new Set(['看到','见到','目击','刚发现']);

@Injectable()
export class AiBridgeService {
  private readonly logger = new Logger(AiBridgeService.name);
  private mode: 'http' | 'stub' | 'hybrid' = 'hybrid';
  private baseUrl = 'http://localhost:8000';
  private http: any = null;

  constructor(private readonly cfg: ConfigService) {}

  /** 在容器启动时(在 comments.module 里调用)配置 mode/http。 */
  init(): void {
    this.mode = ((this.cfg.get<string>('AI_BRIDGE_MODE') as any) || 'hybrid') as any;
    this.baseUrl = this.cfg.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
    if (this.mode === 'http' || this.mode === 'hybrid') {
      try { this.http = require('axios'); } catch { this.http = null; this.mode = 'stub'; }
    }
  }

  async moderate(content: string, reporterId: string, recentViolationsCount = 0): Promise<ModerateResult> {
    if (this.mode === 'stub') return this.stubModerate(content, recentViolationsCount);
    try {
      const r = await this.http.post(this.baseUrl + '/api/comments/moderate', {
        content, reporter_id: reporterId, recent_violations_count: recentViolationsCount,
      }, { timeout: 1500 });
      return r.data as ModerateResult;
    } catch {
      if (this.mode === 'hybrid') return this.stubModerate(content, recentViolationsCount);
      throw new Error('ai-bridge moderate failed');
    }
  }

  async summarize(animalId: string, comments: Array<Pick<Comment,'content'|'created_at'>>): Promise<CommentSummary> {
    if (this.mode === 'stub') return this.stubSummarize(comments);
    try {
      const r = await this.http.post(this.baseUrl + '/api/comments/summary', {
        animal_id: animalId,
        comments: comments.map((c) => ({ content: c.content, created_at: c.created_at })),
      }, { timeout: 3000 });
      return r.data as CommentSummary;
    } catch {
      if (this.mode === 'hybrid') return this.stubSummarize(comments);
      throw new Error('ai-bridge summarize failed');
    }
  }

  private stubModerate(content: string, recentViolationsCount: number): ModerateResult {
    const s = (content || '').trim();
    const reasons: ModerateReason[] = [];
    if (s.length === 0) {
      reasons.push({ layer: 'L0', detail: 'empty' });
      return { verdict: 'hide', suggested_action: 'hide', reasons, primary_sentiment: CommentSentiment.NEUTRAL, is_hidden: true };
    }
    if (s.length > 500) {
      reasons.push({ layer: 'L0', detail: 'too_long:' + s.length });
      return { verdict: 'hide', suggested_action: 'hide', reasons, primary_sentiment: CommentSentiment.NEUTRAL, is_hidden: true };
    }
    for (const w of BLACKLIST_BAD) if (s.includes(w)) reasons.push({ layer: 'L1', detail: 'badword:' + w });
    for (const w of BLACKLIST_FAKE) if (s.includes(w)) reasons.push({ layer: 'L1', detail: 'fake:' + w });
    if (recentViolationsCount >= 3) reasons.push({ layer: 'L4', detail: 'repeat_offender:' + recentViolationsCount });
    let verdict: ModerateResult['verdict'] = 'allow';
    let action: ModerateResult['suggested_action'] = 'allow';
    let is_hidden = false;
    const hasBad = reasons.some((r) => r.layer === 'L1' && r.detail.startsWith('badword'));
    const hasFake = reasons.some((r) => r.layer === 'L1' && r.detail.startsWith('fake'));
    if (hasBad || recentViolationsCount >= 3) { verdict = 'hide'; action = 'hide'; is_hidden = true; }
    else if (hasFake) { verdict = 'review'; action = 'needs_review'; }
    let primary: CommentSentiment = CommentSentiment.NEUTRAL;
    if (Array.from(REWARD).some((w) => s.includes(w))) primary = CommentSentiment.THANKS;
    else if (Array.from(REPORT).some((w) => s.includes(w))) primary = CommentSentiment.REPORT;
    else if (Array.from(POSITIVE).some((w) => s.includes(w))) primary = CommentSentiment.CARE;
    return { verdict, suggested_action: action, reasons, primary_sentiment: primary, is_hidden };
  }

  private stubSummarize(comments: Array<{ content: string }>): CommentSummary {
    const total = comments.length;
    if (total === 0) return { total: 0, sentiment_dist: {}, top_keywords: [], auto_summary: '0 条评论' };
    const dist: Record<string, number> = {};
    const counter: Record<string, number> = {};
    for (const c of comments) {
      const m = this.stubModerate(c.content, 0);
      dist[m.primary_sentiment] = (dist[m.primary_sentiment] || 0) + 1;
      const toks = (c.content || '').match(/[\u4e00-\u9fa5]{2,6}/g) || [];
      for (const t of toks) counter[t] = (counter[t] || 0) + 1;
    }
    const top = Object.entries(counter).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 8);
    const top_keywords = top.map(([k, n]) => k + '(' + n + ')');
    const care_p = Math.round(((dist.care || 0) * 100) / total);
    const seek_p = Math.round(((dist.seek || 0) * 100) / total);
    const parts: string[] = ['共 ' + total + ' 条评论'];
    const bd: string[] = [];
    if (care_p) bd.push('关心 ' + care_p + '%');
    if (seek_p) bd.push('求助 ' + seek_p + '%');
    if (dist.thanks) bd.push('感谢 ' + Math.round((dist.thanks * 100) / total) + '%');
    if (bd.length) parts.push(';情感分布:' + bd.join(','));
    if (top_keywords.length) parts.push(';高频词:' + top_keywords.slice(0, 5).join(','));
    return { total, sentiment_dist: dist, top_keywords, auto_summary: parts.join('') };
  }
}
