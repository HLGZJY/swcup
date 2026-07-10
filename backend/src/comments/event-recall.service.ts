// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 C】EventRecallService — 事件召回 (两步)
 *
 * 替换原 comments.service.ts:_loadRecentEvents 的硬取最近 5 条
 *
 * Step 1: 同 animal 取最近 5 条 (主路)
 * Step 2: 30 天兜底全局扫描, 过滤 status NOT IN (REJECTED, DUPLICATED), 限 10 条
 *   目的: 用户在评论里描述的"看到金毛"可能匹配的是其他 animal 的走失单
 *   (比如同一地点不同 animal, 或者漏报 animal_id)
 *
 * 合并去重, 按 occurred_at DESC 返回
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RescueEvent, EventStatus } from '../events/entities/event.entity';
import { Animal } from '../animals/entities/animal.entity';

export interface EventCandidate {
  event_id: string;
  event_type: string;
  reporter_id: string;
  occurred_at: string;
  address?: string;
  description?: string;
  event_lat?: number;
  event_lng?: number;
  animal_lat?: number;
  animal_lng?: number;
  /**
   * 【2026-07-10 阶段 E】召回来源
   *   - 'same':     同 animal 最近 N 条 (主路, 硬过滤 10km)
   *   - 'fallback': 30 天全局兜底 (跨 animal, 软衰减保留长尾)
   */
  source: 'same' | 'fallback';
}

const BAD_STATUSES = [EventStatus.REJECTED, EventStatus.DUPLICATED];

@Injectable()
export class EventRecallService {
  private readonly logger = new Logger(EventRecallService.name);

  constructor(
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
  ) {}

  /**
   * 两步召回:
   *   - animal 维度: 同 animal 最近 5 条 (主要)
   *   - 全局兜底: 30 天内, status 合法, 最近 10 条 (跨 animal 兜底)
   * @param animalId 评论所属 animal (主路锚点)
   * @param commentTime 评论时间 (用于 30 天窗口起点)
   * @param opts.sameTake 默认 5, opts.fallbackTake 默认 10, opts.fallbackDays 默认 30
   */
  async recall(
    animalId: string,
    commentTime: Date,
    opts?: { sameTake?: number; fallbackTake?: number; fallbackDays?: number },
  ): Promise<EventCandidate[]> {
    const sameTake = opts?.sameTake ?? 5;
    const fallbackTake = opts?.fallbackTake ?? 10;
    const fallbackDays = opts?.fallbackDays ?? 30;

    // Step 1: 同 animal 最近 N 条
    const same: RescueEvent[] = animalId
      ? await this.eventRepo.find({
          where: { animal_id: animalId },
          order: { occurred_at: 'DESC' },
          take: sameTake,
        })
      : [];

    // Step 2: 30 天全局兜底
    const cutoff = new Date(commentTime.getTime() - fallbackDays * 86400 * 1000);
    let fallback: RescueEvent[] = [];
    try {
      fallback = await this.eventRepo
        .createQueryBuilder('e')
        .where('e.occurred_at >= :cutoff', { cutoff })
        .andWhere('e.status NOT IN (:...bad)', { bad: BAD_STATUSES })
        .orderBy('e.occurred_at', 'DESC')
        .limit(fallbackTake)
        .getMany();
    } catch (e: any) {
      // 兜底查询失败不影响主路
      this.logger.warn(
        `[EventRecallService.recall] fallback 30d 失败: ${e?.message || e}`,
      );
    }

    // 合并去重 (event_id 唯一), 用 set 保留来源
    const seenEventIds = new Set<string>();
    const orderedMerged: { ev: RescueEvent; source: 'same' | 'fallback' }[] = [];
    for (const e of same) {
      if (e && e.event_id && !seenEventIds.has(e.event_id)) {
        seenEventIds.add(e.event_id);
        orderedMerged.push({ ev: e, source: 'same' });
      }
    }
    for (const e of fallback) {
      if (e && e.event_id && !seenEventIds.has(e.event_id)) {
        seenEventIds.add(e.event_id);
        orderedMerged.push({ ev: e, source: 'fallback' });
      }
    }
    const merged = orderedMerged.sort(
      (a, b) =>
        new Date(b.ev.occurred_at).getTime() - new Date(a.ev.occurred_at).getTime(),
    );

    // 获取动物坐标 (用于地理距离衰减)
    let animalLat = 0;
    let animalLng = 0;
    try {
      const animal = await this.animalRepo.findOne({ where: { animal_id: animalId } });
      if (animal) {
        animalLat = animal.location_lat ? Number(animal.location_lat) : 0;
        animalLng = animal.location_lng ? Number(animal.location_lng) : 0;
      }
    } catch (e: any) {
      this.logger.warn(`[EventRecallService] 获取动物坐标失败: ${e?.message || e}`);
    }

    return merged
      .filter(({ ev }) => !BAD_STATUSES.includes(ev.status))
      .map(({ ev, source }) => ({
        event_id: ev.event_id,
        event_type: ev.event_type,
        reporter_id: ev.reporter_id || '',
        occurred_at: ev.occurred_at ? new Date(ev.occurred_at).toISOString() : '',
        address: ev.address || undefined,
        description: ev.description || undefined,
        event_lat: ev.location_lat ? Number(ev.location_lat) : undefined,
        event_lng: ev.location_lng ? Number(ev.location_lng) : undefined,
        animal_lat: animalLat || undefined,
        animal_lng: animalLng || undefined,
        source,
      }));
  }
}
