// -*- coding: utf-8 -*-
/**
 * clue-admin.service.ts
 * Admin 端线索审核与 Phase D 迭代工具。
 */
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AiBridgeService } from '../comments/ai-bridge.service';
import { ClueBridgeService } from '../comments/clue-bridge.service';
import { DictionaryLoader } from '../comments/dictionary.loader';
import { EventCandidate, EventRecallService } from '../comments/event-recall.service';
import { TextNormalizer } from '../comments/text-normalizer';

export interface ClueItem {
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
  status: 'pending' | 'confirmed' | 'rejected';
  recorded_at: string;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
}

export interface ClueListResponse {
  total: number;
  pending_count: number;
  confirmed_count: number;
  rejected_count: number;
  items: Array<ClueItem & { animal_id: string }>;
}

export interface ClueDryRunRequest {
  content?: string;
  animal_id?: string;
  reporter_id?: string;
  comment_time?: string;
}

export interface DictsResponse {
  entities: unknown;
  synonyms: unknown;
  negations: unknown;
  'time-markers': unknown;
  'sentiment-rules': unknown;
}

type DictCategory = 'entities' | 'synonyms' | 'negations' | 'time-markers' | 'sentiment-rules';

const DICT_FILE_BY_CATEGORY: Record<DictCategory, string> = {
  entities: 'entities.json',
  synonyms: 'synonyms.json',
  negations: 'negations.json',
  'time-markers': 'time-markers.json',
  'sentiment-rules': 'sentiment-rules.json',
};

@Injectable()
export class ClueAdminService {
  private readonly logger = new Logger(ClueAdminService.name);

  constructor(
    private readonly clue: ClueBridgeService,
    @Optional() private readonly ai?: AiBridgeService,
    @Optional() private readonly recall?: EventRecallService,
    @Optional() private readonly dict?: DictionaryLoader,
    @Optional() private readonly normalizer?: TextNormalizer,
  ) {}

  /** 拉所有线索。默认只返回 pending, include_all=true 暂保持旧行为。 */
  list(includeAll = false): ClueListResponse {
    const pendingMap = this.clue.listPending();
    const allItems: Array<ClueItem & { animal_id: string }> = [];

    for (const [animalId, arr] of Object.entries(pendingMap)) {
      for (const r of arr) allItems.push({ ...(r as ClueItem), animal_id: animalId });
    }

    if (includeAll) {
      this.logger.warn('[ClueAdminService.list] includeAll 暂不支持, 仅返回 pending');
    }

    allItems.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

    return {
      total: allItems.length,
      pending_count: allItems.length,
      confirmed_count: 0,
      rejected_count: 0,
      items: allItems,
    };
  }

  async decide(
    matchId: string,
    animalId: string,
    decision: 'confirmed' | 'rejected',
    note: string,
    adminId: string,
  ): Promise<{ ok: boolean; persisted?: boolean }> {
    return this.clue.decide(matchId, animalId, decision, note, adminId);
  }

  async dryRun(body: ClueDryRunRequest): Promise<Record<string, unknown>> {
    const animalId = String(body.animal_id || '').trim();
    const rawContent = String(body.content || '').trim();
    if (!animalId) throw new BadRequestException('animal_id required');
    if (!rawContent) throw new BadRequestException('content required');
    if (!this.ai || !this.recall || !this.dict) {
      throw new BadRequestException('clue dry-run dependencies not ready');
    }

    const content = this.normalizeContent(rawContent);
    const reporterId = String(body.reporter_id || 'admin-dry-run');
    const commentTime = body.comment_time ? new Date(body.comment_time) : new Date();
    if (Number.isNaN(commentTime.getTime())) throw new BadRequestException('comment_time invalid');

    const moderation = await this.ai.moderate(content, reporterId, 0);
    const events = await this.recall.recall(animalId, commentTime);
    const candidates = this.scoreCandidates({
      events,
      animalId,
      content,
      reporterId,
      sentiment: moderation.primary_sentiment,
      createdAt: commentTime.toISOString(),
    });
    const best = candidates[0];

    return {
      normalized_content: content,
      sentiment: moderation.primary_sentiment,
      score: best?.score || 0,
      reasons: best?.reasons || [],
      candidate_event_id: best?.event_id || '',
      candidate_events: candidates,
    };
  }

  getDicts(): DictsResponse {
    if (!this.dict) throw new BadRequestException('dictionary loader not ready');
    return {
      entities: this.dict.getEntities(),
      synonyms: this.dict.getSynonyms(),
      negations: this.dict.getNegations(),
      'time-markers': this.dict.getTimeMarkers(),
      'sentiment-rules': this.dict.getSentimentRules(),
    };
  }

  putDict(category: string, body: unknown): { ok: boolean; category: DictCategory; file: string } {
    if (!this.dict) throw new BadRequestException('dictionary loader not ready');
    const normalized = this.normalizeCategory(category);
    this.assertDictPayload(normalized, body);
    const file = DICT_FILE_BY_CATEGORY[normalized];
    const p = path.join(this.dict.getDictsDir(), file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
    fs.renameSync(tmp, p);
    this.dict.reload(file);
    return { ok: true, category: normalized, file };
  }

  reloadDicts(): { ok: boolean } {
    if (!this.dict) throw new BadRequestException('dictionary loader not ready');
    this.dict.loadAll();
    return { ok: true };
  }

  /** 调试用 */
  getStateDir(): string {
    return this.clue.getStateDir();
  }

  private normalizeContent(content: string): string {
    if (!this.normalizer) return content;
    try {
      const cleaned = this.normalizer.normalize(content);
      return cleaned || content;
    } catch (e: any) {
      this.logger.warn(`[ClueAdminService.dryRun] normalizer failed: ${e?.message || e}`);
      return content;
    }
  }

  private scoreCandidates(args: {
    events: EventCandidate[];
    animalId: string;
    content: string;
    reporterId: string;
    sentiment: string;
    createdAt: string;
  }): Array<EventCandidate & { score: number; reasons: string[] }> {
    const dicts = {
      entities: this.dict?.getEntities(),
      synonyms: this.dict?.getSynonyms(),
      negations: this.dict?.getNegations(),
    };
    return args.events
      .map((event) => {
        const score = ClueBridgeService.score(
          {
            comment_id: 'dry-run',
            animal_id: args.animalId,
            content: args.content,
            reporter_id: args.reporterId,
            sentiment: args.sentiment,
            created_at: args.createdAt,
            tokens: this.tokenize(args.content),
          },
          event,
          this.clue.getRules(),
          dicts,
        );
        return { ...event, score: score.score, reasons: score.reasons };
      })
      .sort((a, b) => b.score - a.score);
  }

  private tokenize(content: string): string[] {
    const cjk = (content || '').match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    const en = (content || '').match(/[a-zA-Z]{2,}/g) || [];
    return Array.from(new Set([...cjk, ...en].map((s) => s.toLowerCase())));
  }

  private normalizeCategory(category: string): DictCategory {
    const key = category.replace(/\.json$/i, '') as DictCategory;
    if (!Object.prototype.hasOwnProperty.call(DICT_FILE_BY_CATEGORY, key)) {
      throw new BadRequestException('unknown dict category');
    }
    return key;
  }

  private assertDictPayload(category: DictCategory, body: unknown): void {
    if (!body || typeof body !== 'object') throw new BadRequestException('dict body must be object');
    const obj = body as any;
    if (obj.version !== 1) throw new BadRequestException('dict version must be 1');
    const ok =
      (category === 'entities' && obj.categories && typeof obj.categories === 'object') ||
      (category === 'synonyms' && Array.isArray(obj.groups)) ||
      (category === 'negations' && Array.isArray(obj.words)) ||
      (category === 'time-markers' && Array.isArray(obj.markers)) ||
      (category === 'sentiment-rules' && Array.isArray(obj.trigger) && obj.scoring);
    if (!ok) throw new BadRequestException('dict schema invalid');
  }
}
