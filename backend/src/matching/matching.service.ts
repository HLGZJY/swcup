import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Animal } from '../animals/entities/animal.entity';
import { RescueEvent } from '../events/entities/event.entity';

/**
 * 上报事件匹配服务
 *
 * 适用场景: event_type='report' 的事件 (没有鼻纹向量)
 * 匹配目标: status='lost' 的动物 (主人报失的)
 *
 * 评分维度 (共 3 个, 加权融合):
 *   - GPS 距离   gps_similarity     (50%) — haversine + 距离衰减, 最客观
 *   - 文本匹配   text_match_rate    (30%) — breed+color+gender 关键词
 *   - 时间接近度 time_score         (20%) — 报时间 vs lost 动物 first_seen_at
 *
 * 重要变更 (用户确认 2026-06-13):
 *   - 移除原 "图像相似度" 维度 (0.4 加权) — AI service 不具备全身照 pHash / 通用图像特征能力
 *     之前误用鼻纹 vector 充当图像相似度, 语义错 (鼻纹细粒度模式 vs 全身照是不同 domain)
 *     用户决定: 实现不了就彻底去掉
 *   - 原 0.4 加权重新分配为 gps 0.5 + text 0.3 + time 0.2
 *   - 字段 image_similarity 保留 (数据库兼容, 历史值不动), 永远 null
 *
 * 关键设计:
 *   - 不用鼻纹 (report 事件没采鼻纹)
 *   - 返回 top N 候选, 供 admin 审核页展示
 */

const FUSION_WEIGHTS = {
  gps: 0.5,
  text: 0.3,
  time: 0.2,
};

// GPS 距离评分: ≤500m 满分, 5km 归零
function distanceToScore(m: number): number {
  if (m <= 500) return 1.0;
  if (m >= 5000) return 0;
  return parseFloat((1 - (m - 500) / 4500).toFixed(4));
}

// 文本匹配: 关键词重合度 (breed/color/gender)
function textScore(event: RescueEvent, animal: Animal): number {
  const eventKw = [event.breed, event.color, event.gender].filter(Boolean);
  const animalKw = [animal.breed, animal.color, animal.gender].filter(Boolean);
  if (eventKw.length === 0 || animalKw.length === 0) return 0;
  const intersection = eventKw.filter(k =>
    animalKw.some(v => v && k && (String(k).includes(String(v)) || String(v).includes(String(k))))
  );
  return parseFloat((intersection.length / Math.max(eventKw.length, animalKw.length)).toFixed(4));
}

// 时间接近度: 时间差 ≤1天=1.0, ≥7天=0, 中间线性衰减
function timeScore(eventAt: Date | undefined, animalFirstSeen: Date | undefined): number {
  if (!eventAt || !animalFirstSeen) return 0;
  const days = Math.abs(new Date(eventAt).getTime() - new Date(animalFirstSeen).getTime()) / 86400000;
  if (days <= 1) return 1.0;
  if (days >= 7) return 0;
  return parseFloat((1 - (days - 1) / 6).toFixed(4));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ReportCandidate {
  animal_id: string;
  breed: string;
  color: string;
  gender: string;
  status: string;
  photos: string[];
  address: string;
  fusion_score: number;
  scores: {
    image_similarity: number | null;
    gps_similarity: number;
    text_match_rate: number;
    time_score: number;
  };
  distance_m: number;
  is_recommended: boolean;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly AI_SERVICE_URL: string;

  constructor(
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    private readonly config: ConfigService,
  ) {
    this.AI_SERVICE_URL =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  /**
   * 找上报事件最可能的"走失动物"候选
   * @param event report 事件 (无鼻纹)
   * @param limit 返回前 N 个
   */
  async findSimilarLostAnimalsForReport(event: RescueEvent, limit: number = 5): Promise<ReportCandidate[]> {
    // 1. 筛选候选: status IN ('lost','found') + 同物种 + 5km 内 (粗筛, 避免无效 AI 调用)
    // Bug B Part 2 修复 (2026-07-08): 之前只查 status='lost',漏掉 'found' 动物
    //   场景: 路人目击 stray_sighting → admin 审核 → 应找到同区域已"found"的动物合并
    //   修复: IN ('lost','found'),让候选池包含刚捡到/主人在找的所有动物
    const eventLat = Number(event.location_lat);
    const eventLng = Number(event.location_lng);
    if (!eventLat || !eventLng || eventLat === 0 || eventLng === 0) {
      this.logger.warn(`[MatchingService] 上报事件 ${event.event_id} 无有效坐标, 跳过 GPS 预筛`);
    }

    const qb = this.animalRepo.createQueryBuilder('a')
      .where('a.status IN (:...statuses)', { statuses: ['lost', 'found'] });
    if (event.species) {
      qb.andWhere('a.species = :species', { species: event.species });
    }
    if (eventLat && eventLng) {
      // 粗筛: ±0.05 度 (~5km), 减少后续计算
      qb.andWhere('a.location_lat BETWEEN :latMin AND :latMax', {
        latMin: eventLat - 0.05, latMax: eventLat + 0.05,
      });
      qb.andWhere('a.location_lng BETWEEN :lngMin AND :lngMax', {
        lngMin: eventLng - 0.05, lngMax: eventLng + 0.05,
      });
    }
    const lostAnimals = await qb.take(100).getMany();
    this.logger.log(`[MatchingService] 上报 ${event.event_id} 找到 ${lostAnimals.length} 只候选走失动物`);

    if (lostAnimals.length === 0) return [];

    // 3. 逐个打分 (去掉了图片特征提向量步骤, 也不调 AI service)
    const candidates: ReportCandidate[] = [];
    for (const animal of lostAnimals) {
      const distM = haversineMeters(eventLat, eventLng, Number(animal.location_lat), Number(animal.location_lng));
      const gpsSim = distanceToScore(distM);
      const textSim = textScore(event, animal);
      const timeSim = timeScore(event.occurred_at, animal.first_seen_at);

      // 去掉 image_similarity 加权 (AI 不具备, 用户决定彻底移除)
      const fusion =
        gpsSim * FUSION_WEIGHTS.gps
        + textSim * FUSION_WEIGHTS.text
        + timeSim * FUSION_WEIGHTS.time;

      candidates.push({
        animal_id: animal.animal_id,
        breed: animal.breed || '',
        color: animal.color || '',
        gender: animal.gender || 'unknown',
        status: animal.status,
        photos: animal.photos || [],
        address: animal.address || '',
        fusion_score: parseFloat(fusion.toFixed(4)),
        scores: {
          image_similarity: null,  // 字段保留 (数据库兼容), 永远 null
          gps_similarity: gpsSim,
          text_match_rate: textSim,
          time_score: timeSim,
        },
        distance_m: Math.round(distM),
        is_recommended: fusion >= 0.75,
      });
    }

    candidates.sort((a, b) => b.fusion_score - a.fusion_score);
    return candidates.slice(0, limit);
  }

  // === AI service 适配 (graceful degradation) ===
  // 之前这里有 tryExtractFeature / tryCompareImage / resolveImageToBase64 三个方法,
  // 用来从报照片提鼻纹 vector 当"图像相似度". 已被用户确认移除 (2026-06-13):
  //   1. AI service 没有 pHash / 通用图像特征接口
  //   2. 用鼻纹 vector 比全身照是语义错
  //   3. 决定彻底去掉, 字段 image_similarity 永远 null
}
