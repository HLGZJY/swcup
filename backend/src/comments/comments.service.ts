// -*- coding: utf-8 -*-

import { Injectable, HttpException, HttpStatus, NotFoundException, Logger } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository, IsNull } from 'typeorm';

import { Comment, CommentSentiment } from './entities/comment.entity';

import { CreateCommentDto } from './dto/create-comment.dto';

import { QueryCommentDto } from './dto/query-comment.dto';

import { AiBridgeService, CommentSummary } from './ai-bridge.service';



import { Animal, AnimalStatus } from '../animals/entities/animal.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(): string {
  // RFC4122 v4-ish (node:crypto) —— jest 单测会 mock global.crypto
  // 实际运行环境是 Node 16+,直接用 crypto.randomUUID
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const c = require('crypto');
  return c.randomUUID();
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);
  // 60 秒同 reporter + 同 content 去重缓存
  private recentByReporter = new Map<string, { comment_id: string; expires_at: number }>();

  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    private readonly ai: AiBridgeService,
  ) {}

  /** 创建评论: 状态联动 + AI 审核 + 写库 */
  async create(dto: CreateCommentDto, reporterId: string): Promise<Comment> {
    if (!UUID_RE.test(dto.animal_id)) {
      throw new HttpException('animal_id 不合法', HttpStatus.BAD_REQUEST);
    }
    const animal = await this.animalRepo.findOne({ where: { animal_id: dto.animal_id } });
    if (!animal) throw new NotFoundException('动物不存在: ' + dto.animal_id);
    // 建议 #3: 状态联动 — claimed / archived 拒绝评论
    if (animal.status === AnimalStatus.CLAIMED || animal.status === AnimalStatus.ARCHIVED) {
      throw new HttpException(
        '该动物已进入归档/已认领状态,不再接受评论',
        HttpStatus.LOCKED, // 423
      );
    }

    // 建议 #3: 60s 去重
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

    // AI 审核(L0~L4,跨评论画像在 controller 层计算传入)
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
    return saved;
  }

  async findByAnimal(animalId: string, query: QueryCommentDto): Promise<{ total: number; items: Comment[] }> {
    if (!UUID_RE.test(animalId)) {
      throw new HttpException('animal_id 不合法', HttpStatus.BAD_REQUEST);
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
      throw new HttpException('animal_id 不合法', HttpStatus.BAD_REQUEST);
    }
    // 只对可见评论做摘要
    const items = await this.repo.find({
      where: { animal_id: animalId, is_hidden: false },
      select: ['content', 'created_at'],
      order: { created_at: 'DESC' },
      take: 200,
    });
    return this.ai.summarize(animalId, items);
  }

  /** 给单测用:清空 dedup 缓存 */
  _resetCache() { this.recentByReporter.clear(); }
}
