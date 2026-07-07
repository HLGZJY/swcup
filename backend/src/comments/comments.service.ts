// -*- coding: utf-8 -*-

import { Injectable, HttpException, HttpStatus, NotFoundException, Logger, Optional } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository, IsNull } from 'typeorm';

import { Comment, CommentSentiment } from './entities/comment.entity';

import { CreateCommentDto } from './dto/create-comment.dto';

import { QueryCommentDto } from './dto/query-comment.dto';

import { AiBridgeService, CommentSummary } from './ai-bridge.service';

import { ClueBridgeService } from './clue-bridge.service';



import { Animal, AnimalStatus } from '../animals/entities/animal.entity';

import { RescueEvent, EventStatus } from '../events/entities/event.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(): string {
  // RFC4122 v4-ish (node:crypto) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â jest ÃƒÂ¥Ã‚ÂÃ¢â‚¬Â¢ÃƒÂ¦Ã‚ÂµÃ¢â‚¬Â¹ÃƒÂ¤Ã‚Â¼Ã…Â¡ mock global.crypto
  // ÃƒÂ¥Ã‚Â®Ã…Â¾ÃƒÂ©Ã¢â€žÂ¢Ã¢â‚¬Â¦ÃƒÂ¨Ã‚Â¿Ã‚ÂÃƒÂ¨Ã‚Â¡Ã…â€™ÃƒÂ§Ã…Â½Ã‚Â¯ÃƒÂ¥Ã‚Â¢Ã†â€™ÃƒÂ¦Ã‹Å“Ã‚Â¯ Node 16+,ÃƒÂ§Ã¢â‚¬ÂºÃ‚Â´ÃƒÂ¦Ã…Â½Ã‚Â¥ÃƒÂ§Ã¢â‚¬ÂÃ‚Â¨ crypto.randomUUID
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const c = require('crypto');
  return c.randomUUID();
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);
  // 60 ÃƒÂ§Ã‚Â§Ã¢â‚¬â„¢ÃƒÂ¥Ã‚ÂÃ…â€™ reporter + ÃƒÂ¥Ã‚ÂÃ…â€™ content ÃƒÂ¥Ã…Â½Ã‚Â»ÃƒÂ©Ã¢â‚¬Â¡Ã‚ÂÃƒÂ§Ã‚Â¼Ã¢â‚¬Å“ÃƒÂ¥Ã‚Â­Ã‹Å“
  private recentByReporter = new Map<string, { comment_id: string; expires_at: number }>();

  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    @Optional() @InjectRepository(RescueEvent) private readonly eventRepo?: Repository<RescueEvent>,
    private readonly ai: AiBridgeService,
    private readonly clue: ClueBridgeService,
  ) {}

  /** ÃƒÂ¥Ã‹â€ Ã¢â‚¬ÂºÃƒÂ¥Ã‚Â»Ã‚ÂºÃƒÂ¨Ã‚Â¯Ã¢â‚¬Å¾ÃƒÂ¨Ã‚Â®Ã‚Âº: ÃƒÂ§Ã…Â Ã‚Â¶ÃƒÂ¦Ã¢â€šÂ¬Ã‚ÂÃƒÂ¨Ã‚ÂÃ¢â‚¬ÂÃƒÂ¥Ã…Â Ã‚Â¨ + AI ÃƒÂ¥Ã‚Â®Ã‚Â¡ÃƒÂ¦Ã‚Â Ã‚Â¸ + ÃƒÂ¥Ã¢â‚¬Â Ã¢â€žÂ¢ÃƒÂ¥Ã‚ÂºÃ¢â‚¬Å“ */
  async create(dto: CreateCommentDto, reporterId: string): Promise<Comment> {
    if (!UUID_RE.test(dto.animal_id)) {
      throw new HttpException('animal_id ÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¥Ã‚ÂÃ‹â€ ÃƒÂ¦Ã‚Â³Ã¢â‚¬Â¢', HttpStatus.BAD_REQUEST);
    }
    const animal = await this.animalRepo.findOne({ where: { animal_id: dto.animal_id } });
    if (!animal) throw new NotFoundException('ÃƒÂ¥Ã…Â Ã‚Â¨ÃƒÂ§Ã¢â‚¬Â°Ã‚Â©ÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¥Ã‚Â­Ã‹Å“ÃƒÂ¥Ã…â€œÃ‚Â¨: ' + dto.animal_id);
    // ÃƒÂ¥Ã‚Â»Ã‚ÂºÃƒÂ¨Ã‚Â®Ã‚Â® #3: ÃƒÂ§Ã…Â Ã‚Â¶ÃƒÂ¦Ã¢â€šÂ¬Ã‚ÂÃƒÂ¨Ã‚ÂÃ¢â‚¬ÂÃƒÂ¥Ã…Â Ã‚Â¨ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â claimed / archived ÃƒÂ¦Ã¢â‚¬Â¹Ã¢â‚¬â„¢ÃƒÂ§Ã‚Â»Ã‚ÂÃƒÂ¨Ã‚Â¯Ã¢â‚¬Å¾ÃƒÂ¨Ã‚Â®Ã‚Âº
    if (animal.status === AnimalStatus.CLAIMED || animal.status === AnimalStatus.ARCHIVED) {
      throw new HttpException(
        'ÃƒÂ¨Ã‚Â¯Ã‚Â¥ÃƒÂ¥Ã…Â Ã‚Â¨ÃƒÂ§Ã¢â‚¬Â°Ã‚Â©ÃƒÂ¥Ã‚Â·Ã‚Â²ÃƒÂ¨Ã‚Â¿Ã¢â‚¬ÂºÃƒÂ¥Ã¢â‚¬Â¦Ã‚Â¥ÃƒÂ¥Ã‚Â½Ã¢â‚¬â„¢ÃƒÂ¦Ã‚Â¡Ã‚Â£/ÃƒÂ¥Ã‚Â·Ã‚Â²ÃƒÂ¨Ã‚Â®Ã‚Â¤ÃƒÂ©Ã‚Â¢Ã¢â‚¬Â ÃƒÂ§Ã…Â Ã‚Â¶ÃƒÂ¦Ã¢â€šÂ¬Ã‚Â,ÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¥Ã¢â‚¬Â Ã‚ÂÃƒÂ¦Ã…Â½Ã‚Â¥ÃƒÂ¥Ã‚ÂÃ¢â‚¬â€ÃƒÂ¨Ã‚Â¯Ã¢â‚¬Å¾ÃƒÂ¨Ã‚Â®Ã‚Âº',
        HttpStatus.LOCKED, // 423
      );
    }

    // ÃƒÂ¥Ã‚Â»Ã‚ÂºÃƒÂ¨Ã‚Â®Ã‚Â® #3: 60s ÃƒÂ¥Ã…Â½Ã‚Â»ÃƒÂ©Ã¢â‚¬Â¡Ã‚Â
    const content = dto.content.trim();
    const dedupKey = reporterId + '|' + content;
    const now = Date.now();
    for (const [k, v] of this.recentByReporter) {
      if (v.expires_at < now) this.recentByReporter.delete(k);
    }
    const cached = this.recentByReporter.get(dedupKey);
    if (cached) {
      const existing = await this.repo.findOne({ where: { comment_id: cached.comment_id } });
      if (existing) return existing;
    }

    // AI ÃƒÂ¥Ã‚Â®Ã‚Â¡ÃƒÂ¦Ã‚Â Ã‚Â¸(L0~L4,ÃƒÂ¨Ã‚Â·Ã‚Â¨ÃƒÂ¨Ã‚Â¯Ã¢â‚¬Å¾ÃƒÂ¨Ã‚Â®Ã‚ÂºÃƒÂ§Ã¢â‚¬ÂÃ‚Â»ÃƒÂ¥Ã†â€™Ã‚ÂÃƒÂ¥Ã…â€œÃ‚Â¨ controller ÃƒÂ¥Ã‚Â±Ã¢â‚¬Å¡ÃƒÂ¨Ã‚Â®Ã‚Â¡ÃƒÂ§Ã‚Â®Ã¢â‚¬â€ÃƒÂ¤Ã‚Â¼Ã‚Â ÃƒÂ¥Ã¢â‚¬Â¦Ã‚Â¥)
    const m = await this.ai.moderate(content, reporterId, 0);

    const cid = uuid();
    const entity = this.repo.create({
      comment_id: cid,
      animal_id: dto.animal_id,
      reporter_id: reporterId,
      content,
      sentiment: m.primary_sentiment,
      is_hidden: m.is_hidden,
    });
    const saved = await this.repo.save(entity);
    this.recentByReporter.set(dedupKey, {
      comment_id: cid,
      expires_at: now + 60_000,
    });

    // ====== P3 ÃƒÂ©Ã¢â‚¬â€Ã‚Â­ÃƒÂ§Ã…Â½Ã‚Â¯: ÃƒÂ¨Ã‚Â§Ã‚Â¦ÃƒÂ¥Ã‚ÂÃ¢â‚¬Ëœ clue matcher (A ÃƒÂ¦Ã‚Â¡Ã‚Â£) ======
    if (
      !saved.is_hidden &&
      (m.primary_sentiment === CommentSentiment.REPORT ||
        m.primary_sentiment === CommentSentiment.SEEK)
    ) {
      try {
        const events = await this._loadRecentEvents(saved.animal_id);
        const clueOut = this.clue.matchComment(
          {
            comment_id: saved.comment_id,
            animal_id: saved.animal_id,
            content: saved.content,
            reporter_id: saved.reporter_id,
            sentiment: saved.sentiment,
            created_at: (saved.created_at instanceof Date
              ? saved.created_at
              : new Date(saved.created_at as any)
            ).toISOString(),
          },
          events,
        );
        const msg = '[CommentsService.create] clue_matcher comment=' + saved.comment_id
          + ' status=' + clueOut.status
          + ' score=' + String(clueOut.match_score)
          + ' candidate=' + clueOut.candidate_event_id;
        this.logger.log(msg);
      } catch (err: any) {
        const wmsg = '[CommentsService.create] clue_matcher failed (non-blocking): ' + (err && err.message ? err.message : String(err));
        this.logger.warn(wmsg);
      }
    }

    return saved;
  }

  /**
   * ÃƒÂ¥Ã…Â Ã‚Â ÃƒÂ¨Ã‚Â½Ã‚Â½ÃƒÂ¦Ã…â€œÃ¢â€šÂ¬ÃƒÂ¨Ã‚Â¿Ã¢â‚¬Ëœ 5 ÃƒÂ¦Ã‚ÂÃ‚Â¡ÃƒÂ¤Ã‚ÂºÃ¢â‚¬Â¹ÃƒÂ¤Ã‚Â»Ã‚Â¶ÃƒÂ§Ã‚Â»Ã¢â€žÂ¢ clue matcher ÃƒÂ¥Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÂ©Ã¢â€šÂ¬Ã¢â‚¬Â°
   * ÃƒÂ¦Ã…Â½Ã¢â‚¬â„¢ÃƒÂ©Ã¢â€žÂ¢Ã‚Â¤ REJECTED/DUPLICATED
   */
  private async _loadRecentEvents(animalId: string): Promise<
    Array<{
      event_id: string;
      event_type: string;
      reporter_id: string;
      occurred_at: string;
      address?: string;
      description?: string;
    }>
  > {
    if (!this.eventRepo) return [];
    const rows = await this.eventRepo.find({
      where: { animal_id: animalId },
      order: { created_at: 'DESC' },
      take: 5,
    });
    return rows
      .filter((e) => e.status !== EventStatus.REJECTED && e.status !== EventStatus.DUPLICATED)
      .map((e) => ({
        event_id: e.event_id,
        event_type: e.event_type,
        reporter_id: e.reporter_id || '',
        occurred_at: e.occurred_at ? e.occurred_at.toISOString() : '',
        address: e.address || undefined,
        description: e.description || undefined,
      }));
  }

  async findByAnimal(animalId: string, query: QueryCommentDto): Promise<{ total: number; items: Comment[] }> {
    if (!UUID_RE.test(animalId)) {
      throw new HttpException('animal_id ÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¥Ã‚ÂÃ‹â€ ÃƒÂ¦Ã‚Â³Ã¢â‚¬Â¢', HttpStatus.BAD_REQUEST);
    }
    const [items, total] = await this.repo.findAndCount({
      where: { animal_id: animalId, is_hidden: false },
      order: { created_at: 'DESC' },
      skip: query.offset,
      take: query.limit,
    });
    return { total, items };
  }

  async summarize(animalId: string): Promise<CommentSummary> {
    if (!UUID_RE.test(animalId)) {
      throw new HttpException('animal_id ÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¥Ã‚ÂÃ‹â€ ÃƒÂ¦Ã‚Â³Ã¢â‚¬Â¢', HttpStatus.BAD_REQUEST);
    }
    // ÃƒÂ¥Ã‚ÂÃ‚ÂªÃƒÂ¥Ã‚Â¯Ã‚Â¹ÃƒÂ¥Ã‚ÂÃ‚Â¯ÃƒÂ¨Ã‚Â§Ã‚ÂÃƒÂ¨Ã‚Â¯Ã¢â‚¬Å¾ÃƒÂ¨Ã‚Â®Ã‚ÂºÃƒÂ¥Ã‚ÂÃ…Â¡ÃƒÂ¦Ã¢â‚¬ËœÃ‹Å“ÃƒÂ¨Ã‚Â¦Ã‚Â
    const items = await this.repo.find({
      where: { animal_id: animalId, is_hidden: false },
      select: ['content', 'created_at'],
      order: { created_at: 'DESC' },
      take: 200,
    });
    return this.ai.summarize(animalId, items);
  }

  /** ÃƒÂ§Ã‚Â»Ã¢â€žÂ¢ÃƒÂ¥Ã‚ÂÃ¢â‚¬Â¢ÃƒÂ¦Ã‚ÂµÃ¢â‚¬Â¹ÃƒÂ§Ã¢â‚¬ÂÃ‚Â¨:ÃƒÂ¦Ã‚Â¸Ã¢â‚¬Â¦ÃƒÂ§Ã‚Â©Ã‚Âº dedup ÃƒÂ§Ã‚Â¼Ã¢â‚¬Å“ÃƒÂ¥Ã‚Â­Ã‹Å“ */
  _resetCache() { this.recentByReporter.clear(); }
}