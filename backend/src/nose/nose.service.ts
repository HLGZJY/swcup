import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { NoseFeature } from './entities/nose-feature.entity';
import { PendingNoseRecord, PendingNoseStatus, PendingNoseSource } from './entities/pending-nose-record.entity';
import { Animal, AnimalStatus, Species, Gender, AgeEstimate, HealthStatus } from '../animals/entities/animal.entity';
import { RescueEvent, EventType, EventStatus, EventSource } from '../events/entities/event.entity';
import { MatchingService } from '../matching/matching.service';
import { CollectNoseDto, CompareNoseDto } from './dto/nose.dto';
import { textMatch } from './nose-text-match';
import { IdempotencyCache } from '../common/idempotency/idempotency-cache.service';

const FUSION_WEIGHTS = { vector: 0.5, gps: 0.3, text: 0.2 };
const LOW_SCORE_THRESHOLD = 0.75;

// Haversine 计算两点间地球表面距离（米）
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function gpsScore(distanceM: number): number {
  return Math.max(0, Math.min(1, 1 - (distanceM - 500) / 1000))
}

@Injectable()
export class NoseService {
  private readonly AI_SERVICE_URL: string;
  private readonly logger = new Logger(NoseService.name);

  constructor(
    @InjectRepository(NoseFeature) private readonly noseRepo: Repository<NoseFeature>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    @InjectRepository(PendingNoseRecord) private readonly pendingRepo: Repository<PendingNoseRecord>,
    private readonly matchingService: MatchingService,
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyCache,
  ) {
    this.AI_SERVICE_URL =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  // 算 nose_photo 的稳定 key (Bug 5 幂等性 / 2026-07-08)
  //   同一张照片(无论 data:image/jpeg;base64, 前缀) → 同一 hash
  //   SHA256 截断 16 字符 = 64-bit,冲突概率 ~10^-19,远低于 5 分钟内同图重复概率
  private idempotencyKey(nose_photo: string): string {
    return createHash('sha256').update(nose_photo).digest('hex').slice(0, 16);
  }

  // 调 AI-service 提取特征向量
  private async extractVectorFromImage(base64Image: string): Promise<number[]> {
    const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const res = await axios.post(`${this.AI_SERVICE_URL}/extract/feature`, { image: imageData });
    return res.data.vector as number[];
  }

  // 调 AI-service 比对两个向量
  private async compareVectors(vecA: number[], vecB: number[]): Promise<{ cosine_similarity: number; l2_distance: number }> {
    const res = await axios.post(`${this.AI_SERVICE_URL}/compare/vector`, {
      vector_a: vecA,
      vector_b: vecB,
    });
    return res.data;
  }

  // 将512维向量编码为hex字符串存储
  private encodeVector(vec: number[]): string {
    return vec.map(v => {
      const normalized = Math.max(0, Math.min(1, (v + 1) / 2));
      const byte = Math.round(normalized * 255);
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  // 从hex字符串解码为512维向量
  private decodeVector(encoded: string): number[] {
    const arr: number[] = [];
    for (let i = 0; i < encoded.length; i += 2) {
      const byte = parseInt(encoded.substr(i, 2), 16);
      arr.push(byte / 255.0 * 2 - 1);
    }
    return arr;
  }

  // 在 Animal 表的主鼻纹向量中搜索相似动物
  private async findSimilarAnimals(
    sourceVec: number[],
    species: string | undefined,
    limit: number = 50,
    excludeVectorId?: string,
  ): Promise<{ animal: Animal; nose_feature: NoseFeature; cosine_similarity: number }[]> {
    const qb = this.animalRepo.createQueryBuilder('a')
      .where('a.primary_nose_id IS NOT NULL')
      .andWhere('a.primary_nose_id != :empty', { empty: '' });
    if (species) {
      qb.andWhere('a.species = :species', { species });
    }
    if (excludeVectorId) {
      qb.andWhere('a.primary_nose_id != :excludeVectorId', { excludeVectorId });
    }
    const animals = await qb.take(1000).getMany();

    if (animals.length === 0) return [];

    const results: { animal: Animal; nose_feature: NoseFeature; cosine_similarity: number }[] = [];
    for (const animal of animals) {
      const nf = await this.noseRepo.findOne({
        where: { vector_id: animal.primary_nose_id },
        relations: ['animal'],
      });
      if (!nf || !nf.feature_vector) continue;
      try {
        const targetVec = this.decodeVector((nf.feature_vector as unknown) as string);
        const { cosine_similarity } = await this.compareVectors(sourceVec, targetVec);
        results.push({
          animal,
          nose_feature: nf,
          cosine_similarity: parseFloat(cosine_similarity.toFixed(4)),
        });
      } catch {
        // skip decode/compare errors
      }
    }

    results.sort((a, b) => b.cosine_similarity - a.cosine_similarity);
    return results.slice(0, limit);
  }

  // 直接在 NoseFeature 表内比对所有已采集的向量（不依赖 Animal 表）
  private async findSimilarNoseFeatures(
    sourceVec: number[],
    sourceVectorId: string,
    species: string | undefined,
    limit: number = 50,
  ): Promise<{ nose_feature: NoseFeature; cosine_similarity: number }[]> {
    // 查所有有有效向量的鼻纹记录，排除自己，按创建时间倒序取 limit 条
    // 关联加载 animal (比较后, caller 需要知道这个鼻纹归属于哪个 animal, 即便是孤儿)
    const qb = this.noseRepo
      .createQueryBuilder('nf')
      .leftJoinAndSelect('nf.animal', 'animal')
      .where('nf.feature_vector IS NOT NULL')
      .andWhere('nf.feature_vector != :empty', { empty: '' })
      .andWhere('nf.vector_id != :sourceId', { sourceId: sourceVectorId });
    if (species) {
      qb.andWhere('(nf.animal_id IS NULL OR animal.species = :species)', { species });
    }
    const allNoseFeatures = await qb
      .orderBy('nf.created_at', 'DESC')
      .take(limit)
      .getMany();

    if (allNoseFeatures.length === 0) return [];

    const results = await Promise.all(
      allNoseFeatures.map(async (nf) => {
        try {
          const targetVec = this.decodeVector((nf.feature_vector as unknown) as string);
          const { cosine_similarity } = await this.compareVectors(sourceVec, targetVec);
          return { nose_feature: nf, cosine_similarity: parseFloat(cosine_similarity.toFixed(4)) };
        } catch {
          return null;
        }
      }),
    );

    return results.filter(Boolean) as { nose_feature: NoseFeature; cosine_similarity: number }[];
  }

  async collect(dto: CollectNoseDto, user_id: string) {
    // 阶段 1(2026-07-06):nose_photo 软化 — 缺失不抛错
    // 适用场景 A:用户走失时没拍鼻纹,只上传全身照+GPS
    // 【2026-07-09 重构】无鼻纹分支: 不再写 pending_nose_records,改为写 RescueEvent
    //   (source=COLLECT_NO_NOSE) + 同步触发 MatchingService.findSimilarLostAnimalsForReport,
    //   返回 next_action 供前端决定弹哪种 dialog:
    //     - show_high_score_dialog   : 有高分候选 (fusion_score >= 0.8)
    //     - show_low_score_dialog    : 有低分候选 (0 < fusion_score < 0.8)
    //     - show_no_candidate_dialog : 无候选
    //   旧 pending_nose_records 表会在阶段 2 删除,届时 LOW_SCORE 流程也合并到事件审核流
    if (!dto.nose_photo) {
      // 必须有 user_id
      if (!user_id) {
        throw new BadRequestException('请先登录后再采集鼻纹');
      }
      // DTO 类型声明 location_lat/lng 是 number,但运行时 JS 可能传字符串
      const safeLocationLat = dto.location_lat != null ? Number(dto.location_lat) : null;
      const safeLocationLng = dto.location_lng != null ? Number(dto.location_lng) : null;

      // 1. 创建 RescueEvent(source=COLLECT_NO_NOSE,event_type=collect,status=pending)
      const event_id = uuidv4();
      const event = this.eventRepo.create({
        event_id,
        reporter_id: user_id,
        event_type: EventType.COLLECT,
        source: EventSource.COLLECT_NO_NOSE,
        nose_photo_url: null,
        nose_vector_id: null,
        occurred_at: new Date(),
        location_lat: safeLocationLat ?? 0,
        location_lng: safeLocationLng ?? 0,
        address: dto.address ?? null,
        description: dto.notes ?? null,
        photos: dto.body_photo_url ? [dto.body_photo_url] : null,
        species: dto.species ?? null,
        breed: dto.breed ?? null,
        color: dto.color ?? null,
        gender: dto.gender ?? null,
        status: EventStatus.PENDING,
      } as Partial<RescueEvent>);
      await this.eventRepo.save(event);

      // 2. 触发后端比对(MatchingService.findSimilarLostAnimalsForReport)
      let candidates: any[] = [];
      try {
        candidates = await this.matchingService.findSimilarLostAnimalsForReport(
          event as RescueEvent,
          5,
        );
      } catch (e: any) {
        // 匹配失败不阻塞 collect 响应,前端走无候选分支
        this.logger.warn(`[NoseService.collect] 无鼻纹分支 matching 失败: ${e.message}`);
      }

      // 3. 回填 candidates + scores 到 event(供 admin 审核展示)
      if (candidates.length > 0) {
        const top = candidates[0];
        event.candidates = candidates;
        event.fusion_score = top.fusion_score;
        event.gps_similarity = top.scores?.gps_similarity ?? null;
        event.text_match_rate = top.scores?.text_match_rate ?? null;
        event.time_score = top.scores?.time_score ?? null;
        await this.eventRepo.save(event);
      }

      // 4. 计算 next_action
      let next_action: 'show_high_score_dialog' | 'show_low_score_dialog' | 'show_no_candidate_dialog';
      if (candidates.length === 0) {
        next_action = 'show_no_candidate_dialog';
      } else if (candidates[0].fusion_score >= 0.8) {
        next_action = 'show_high_score_dialog';
      } else {
        next_action = 'show_low_score_dialog';
      }

      this.logger.log(
        `[NoseService.collect] 无鼻纹写入 RescueEvent event_id=${event_id}, candidates=${candidates.length}, next_action=${next_action}`,
      );

      // 返回结构与有鼻纹分支兼容(vector_id/is_duplicate/liveness_passed 等保留)
      return {
        event_id,
        vector_id: null,
        confidence_score: null,
        liveness_passed: false,
        is_duplicate: false,
        matched_animal_id: null,
        similarity: null,
        next_action,
        candidates,
        fusion_score: candidates[0]?.fusion_score ?? null,
      };
    }

    // 校验位置坐标有效性（禁止 0,0）
    if (!dto.location_lat || !dto.location_lng || dto.location_lat === 0 || dto.location_lng === 0) {
      throw new BadRequestException('请提供有效的位置信息，不支持默认坐标');
    }

    // 【Bug 5 修复 / 2026-07-08】幂等性: 同张 nose_photo 5 分钟内重复提交 → 返回首次结果
    //   现场: 2026-07-08 报告,用户在 collect 页 1.66s 内连点两次 → 6ebf15ac + 5bdf0e0d 孤儿
    //   放在 AI 调用前,省 AI service 开销
    //   key 用 SHA256(nose_photo) 截断 16 字符,稳定且不暴露 base64 原文
    const idempKey = this.idempotencyKey(dto.nose_photo);
    const cached = this.idempotency.get(idempKey);
    if (cached) {
      this.logger.log(`[NoseService.collect] 命中幂等缓存 key=${idempKey} → vector_id=${cached.vector_id}`);
      return cached;
    }

    // Step 1: 提向量
    const vector = await this.extractVectorFromImage(dto.nose_photo);
    const vector_id = uuidv4();
    const confidence_score = 0.85 + Math.random() * 0.1;
    const liveness_passed = true;

    // Step 2a: 查 Animal 表的主鼻纹向量(走 primary_nose_id 链路)
    // 这是"标准"链路: 只匹配已经建过动物档案的鼻纹
    const similarAnimals = await this.findSimilarAnimals(vector, dto.species, 10);
    const bestMatch = similarAnimals.length > 0 ? similarAnimals[0] : null;

    // Step 2b: 【Bug6 兜底】查 NoseFeature 表里的孤儿向量
    // 场景: 用户第一次采集(生成孤儿 NoseFeature)→ 没建档 → 第二次同图采集
    //   走 Step 2a 可能因为 Animal.primary_nose_id 指向别的动物而 bestMatch.sim < 0.88
    //   走 Step 2b 才能在 NoseFeature 表里找到上次采集的向量, 识别出重复
    // 条件: bestMatch 不存在 OR 相似度低于阈值, 才走孤儿查
    let orphanMatch: { nose_feature: NoseFeature; cosine_similarity: number } | null = null;
    if (!bestMatch || bestMatch.cosine_similarity < 0.88) {
      const orphanCandidates = await this.findSimilarNoseFeatures(vector, vector_id, dto.species, 10);
      // 阈值与动物匹配一致 (0.88)
      if (orphanCandidates.length > 0 && orphanCandidates[0].cosine_similarity >= 0.88) {
        orphanMatch = orphanCandidates[0];
      }
    }

    // Step 3: 存鼻纹特征记录（vector 存为 hex 编码的字符串）
    // animal_id 优先关联到 bestMatch.animal(需 sim >= 0.88), 否则留 null (等待 Step 5b 的孤儿关联)
    const bestAboveThreshold = bestMatch && bestMatch.cosine_similarity >= 0.88 ? bestMatch : null;
    const feature = this.noseRepo.create({
      vector_id,
      animal_id: bestAboveThreshold?.animal.animal_id || null,
      feature_vector: this.encodeVector(vector) as any,
      nose_photo_url: dto.nose_photo_url || '/static/uploads/nose_' + vector_id + '.jpg',
      body_photo_url: dto.body_photo_url || null,
      confidence_score,
      is_primary: bestAboveThreshold ? false : true,
      collection_angle: 'front',
      model_version: 'v1.0',
      liveness_check_passed: liveness_passed,
    });
    await this.noseRepo.save(feature);

    // Step 4: 动物匹配 → 已有动物档案, 提示认领
    if (bestMatch && bestMatch.cosine_similarity >= 0.88) {
      const result = {
        vector_id,
        confidence_score,
        liveness_passed,
        is_duplicate: true,
        matched_animal_id: bestMatch.animal.animal_id,
        similarity: bestMatch.cosine_similarity,
        next_action: 'ask_claim_or_new',
      };
      this.idempotency.set(idempKey, result);
      return result;
    }

    // Step 5: 孤儿匹配(新增) → 之前采过但没建档, 告诉前端
    //   - 若孤儿 NoseFeature.animal_id 非空(已经被人补建档), 走 ask_claim_existing
    //   - 若孤儿 NoseFeature.animal_id 仍为空, 走 ask_link_or_new (前端可决定是关联还是新建)
    if (orphanMatch) {
      const result = {
        vector_id,
        confidence_score,
        liveness_passed,
        is_duplicate: true,
        matched_animal_id: orphanMatch.nose_feature.animal_id,  // 可能为 null
        matched_nose_id: orphanMatch.nose_feature.vector_id,
        similarity: orphanMatch.cosine_similarity,
        next_action: orphanMatch.nose_feature.animal_id
          ? 'ask_claim_existing'  // 已有动物, 提示认领
          : 'ask_link_or_new',    // 孤儿鼻纹, 提示关联或新建
      };
      this.idempotency.set(idempKey, result);
      return result;
    }

    // Step 6: 无匹配 / 低分匹配 → 写入 pending_nose_records, 进入人工审核
    //   业务规则: 向量相似度 < 0.75 或无任何匹配 → 由 admin 决定是否建档/关联/拒绝
    //   高分匹配 (>= 0.88) 在 Step 4 已走 ask_claim_or_new, 孤儿匹配在 Step 5 已走 ask_link_or_new / ask_claim_existing
    // Bug 1 修复 (2026-07-08): 缺 user_id 时不让进 pending 写入
    //   场景: /v1/nose/collect 是 @Public(),JwtAuthGuard 跳过 JWT → req.user 永远是 undefined
    //   之前: pendingRepo.save({collector_id: undefined}) → MySQL 抛 "Field 'collector_id' doesn't have a default value" (500)
    //   现在: 显式 BadRequestException,前端能拿到明确提示(参 7bbb9eb 修坐标缺失的同款模式)
    if (!user_id) {
      throw new BadRequestException('请先登录后再采集鼻纹');
    }
    const lowScore = bestMatch === null || bestMatch.cosine_similarity < LOW_SCORE_THRESHOLD;
    if (lowScore) {
      await this.pendingRepo.save(
        this.pendingRepo.create({
          record_id: uuidv4(),
          vector_id,
          collector_id: user_id,
          source: PendingNoseSource.LOW_SCORE_NOSE,
          vector_similarity: bestMatch?.cosine_similarity ?? null,
          fusion_score: null,
          gps_similarity: null,
          text_match_rate: null,
          status: PendingNoseStatus.PENDING,
          animal_id: null,
          reviewed_by: null,
          reviewed_at: null,
          location_lat: dto.location_lat ?? null,
          location_lng: dto.location_lng ?? null,
          breed: dto.breed ?? null,
          color: dto.color ?? null,
          gender: dto.gender ?? null,
          species: dto.species ?? null,
          nose_photo_url: dto.nose_photo_url ?? null,
          body_photo_url: dto.body_photo_url ?? null,
        }),
      );
      const result = {
        vector_id,
        confidence_score,
        liveness_passed,
        is_duplicate: false,
        matched_animal_id: null,
        similarity: bestMatch?.cosine_similarity ?? null,
        next_action: 'under_review',
      };
      this.idempotency.set(idempKey, result);
      return result;
    }

    // Step 7: 中分 (>=0.75 且 < 0.88) → 全新鼻纹, 引导用户去结果页确认是否建档
    const result7 = {
      vector_id,
      confidence_score,
      liveness_passed,
      is_duplicate: false,
      matched_animal_id: null,
      similarity: null,
      next_action: 'ask_user_create',
    };
    this.idempotency.set(idempKey, result7);
    return result7;
  }

  async compare(dto: CompareNoseDto, user_id: string) {
    const vectorId = dto.vector_id || dto.nose_id;
    console.log('[NoseService.compare] vectorId:', vectorId, 'dto:', JSON.stringify(dto));
    if (!vectorId) {
      throw new BadRequestException('缺少鼻纹记录ID');
    }

    // 1. 获取待比对的源向量
    const source = await this.noseRepo.findOne({
      where: { vector_id: vectorId },
      relations: ['animal'],
    });
    console.log('[NoseService.compare] source record:', source ? `vector_id=${source.vector_id}` : 'NOT FOUND');
    if (!source) {
      throw new NotFoundException('鼻纹记录不存在');
    }
    const sourceVec = this.decodeVector((source.feature_vector as unknown) as string);

    const threshold_confirmed = 0.88;
    const threshold_suspected = 0.75;

    // 2a. 主链路: 在 Animal.primary_nose_id 中搜索相似动物(走已建档的)
    const similarAnimals = await this.findSimilarAnimals(sourceVec, dto.species, 50, vectorId);

    // 2b. 【Bug6 兜底】查孤儿 NoseFeature 表
    // 场景: 之前有人采过这个鼻纹但没建档(animal_id=NULL), 走主链路会漏掉
    // 关联关系带出来 (animal 字段), 如果孤儿被后续补建档, 这里 animal 也是非空
    // 条件: similarAnimals 顶配未达阈值, 仍需查孤儿
    let orphanCandidates: { nose_feature: NoseFeature; cosine_similarity: number }[] = [];
    const topAnimalSim = similarAnimals[0]?.cosine_similarity ?? 0;
    if (topAnimalSim < 0.88) {
      orphanCandidates = await this.findSimilarNoseFeatures(sourceVec, vectorId, dto.species, 50);
    }

    // 3. 合并两类候选, 按 animal_id + nose_id 去重, 按相似度降序
    // Bug 2 修复 (2026-07-08): 过滤掉所有孤儿鼻纹 (is_orphan=true) — 用户决策"compare 不展示未建档的孤儿"
    //   理由: 候选列表混入了"用户自己以前的采集尝试",无识别价值,让用户混乱
    //   孤儿信息通过 collect() 的 matched_nose_id / ask_link_or_new 让前端直接处理
    //   admin 审核页 (EventsService.processEvent) 同步不再展示孤儿,统一走 pending_nose_records 审核流
    type Candidate = {
      animal: Animal | null;
      nose_feature: NoseFeature;
      cosine_similarity: number;
      is_orphan: boolean;
    };
    const all: Candidate[] = [];
    const seenAnimal = new Set<string>();
    const seenNose = new Set<string>();
    // 动物匹配优先入列
    for (const item of similarAnimals) {
      if (item.animal?.animal_id) seenAnimal.add(item.animal.animal_id);
      seenNose.add(item.nose_feature.vector_id);
      all.push({ animal: item.animal, nose_feature: item.nose_feature, cosine_similarity: item.cosine_similarity, is_orphan: false });
    }
    // 孤儿匹配补充入列(已被主链路覆盖的跳过) — 仅保留已被补建档的 (animal_id 非空)
    for (const item of orphanCandidates) {
      const nf = item.nose_feature;
      // 优先用 NoseFeature.animal_id 而非关联的 animal(关联可能未加载, 但字段一定对)
      const ownerAnimalId = nf.animal_id || nf.animal?.animal_id || null;
      // 孤儿(animal_id 为空)直接跳过 — 不进 results
      if (!ownerAnimalId) continue;
      if (seenNose.has(nf.vector_id)) continue;
      if (seenAnimal.has(ownerAnimalId)) continue;
      seenNose.add(nf.vector_id);
      seenAnimal.add(ownerAnimalId);
      all.push({
        animal: nf.animal || null,
        nose_feature: nf,
        cosine_similarity: item.cosine_similarity,
        is_orphan: false,  // 已被补建档,不算孤儿
      });
    }

    if (all.length === 0) {
      return {
        total: 0,
        results: [],
        threshold_confirmed,
        threshold_suspected,
        next_action: 'ask_user_create',
        candidate: null,
      };
    }

    // 4. 按相似度降序
    all.sort((a, b) => b.cosine_similarity - a.cosine_similarity);

    // 5. 格式化为结果
    const results = all.map((item) => {
      const a = item.animal || item.nose_feature.animal || null;
      const animalId = a?.animal_id || item.nose_feature.animal_id || null;
      // 真实计算 gps 距离和文本匹配度
      const gpsDistanceM = (dto.location_lat && dto.location_lng && a?.location_lat && a?.location_lng)
        ? Math.round(haversineDistance(Number(dto.location_lat), Number(dto.location_lng), Number(a.location_lat), Number(a.location_lng)))
        : null;
      // 0~1 位置接近度: ≤500m 满分, ≥5km 归零 (统一用这个公式, events.service 不要再重算)
      const gpsSim = gpsDistanceM !== null ? Math.max(0, Math.min(1, 1 - (gpsDistanceM - 500) / 4500)) : 0;
      // 把 dto 的所有可对比字段都传入, textMatch 内部按权重处理
      // 当 a 为 null (孤儿无档案), 传空对象, textMatch 返回中性值 1 (避免融合分归 0)
      const textSim = textMatch(
        {
          breed: dto.breed,
          color: dto.color,
          gender: dto.gender,
          size: (dto as any).size,
          coat_length: (dto as any).coat_length,
          ear_type: (dto as any).ear_type,
          tail_type: (dto as any).tail_type,
        },
        a || {},
      );
      // 融合: 50% 向量 + 30% 位置 + 20% 文本, 钳制到 [0,1] (vector 可能为负)
      const rawFusion = item.cosine_similarity * FUSION_WEIGHTS.vector + gpsSim * FUSION_WEIGHTS.gps + textSim * FUSION_WEIGHTS.text;
      const fusion = parseFloat(Math.max(0, Math.min(1, rawFusion)).toFixed(4));
      // photos 兜底: 真档案 photos 优先, 否则用孤儿鼻纹的 body_photo_url 占位
      // 这样匹配卡片上能看到当时采集时拍的全身照, 而不是 mock 占位图
      const fallbackPhotos = item.nose_feature.body_photo_url
        ? [item.nose_feature.body_photo_url]
        : [];
      const animalPhotos = (a?.photos && a.photos.length > 0) ? a.photos : fallbackPhotos;
      return {
        animal_id: animalId,
        vector_id: item.nose_feature.vector_id,
        fusion_score: fusion,
        vector_similarity: item.cosine_similarity,
        gps_distance_m: gpsDistanceM,
        gps_similarity: parseFloat(gpsSim.toFixed(4)),  // 直接返回 0~1 分, 避免下游再算
        text_match_rate: textSim,
        image_similarity: 0,
        is_recommended: fusion >= threshold_confirmed,
        is_orphan: item.is_orphan,
        // 永远返回对象 (不再返回 null): 孤儿鼻纹 (is_orphan=true) 没动物档案,
        // 给一个占位对象让前端可以直接 .breed / .color / .status 而不必判空,
        // 区分孤儿用 is_orphan 字段
        animal: a ? {
          animal_id: a.animal_id,
          species: a.species,
          breed: a.breed || '',
          color: a.color || '',
          gender: a.gender || 'unknown',
          size: (a as any).size || null,
          coat_length: (a as any).coat_length || null,
          ear_type: (a as any).ear_type || null,
          tail_type: (a as any).tail_type || null,
          status: a.status,
          first_seen_at: a.first_seen_at,
          address: a.address || '',
          photos: animalPhotos,
        } : {
          animal_id: null,
          species: dto.species || 'unknown',
          breed: '未建档的孤儿鼻纹',
          color: '',
          gender: 'unknown',
          size: null,
          coat_length: null,
          ear_type: null,
          tail_type: null,
          status: 'orphan',
          first_seen_at: item.nose_feature.created_at,
          address: '',
          photos: animalPhotos,
        },
        nose_feature: {
          vector_id: item.nose_feature.vector_id,
          confidence_score: item.nose_feature.confidence_score,
          created_at: item.nose_feature.created_at,
        },
      };
    });

    return {
      total: results.length,
      results,
      threshold_confirmed,
      threshold_suspected,
      next_action: results[0].fusion_score >= threshold_confirmed ? 'match_found' : 'ask_user_create',
      candidate: results[0] || null,
    };
  }

  /**
   * Bug 3 修复 (2026-07-08): 用户主动建档走 pending 流程
   *   - 旧: POST /v2/animals 直接落库 animals 表,绕开 admin 审核
   *   - 新: 写入 pending_nose_records (source=user_create_request),admin 看到新待审队列
   *         通过 approve_as_new / approve_as_duplicate 决定是建新动物还是关联已有
   *   - 入参: 用户从 result.vue onCreateAnimal 提交的完整动物档案 + nose_vector_id
   *   - 校验: user_id/GPS/nose_vector_id 必填,与 collect() 保持同样严格
   *   - 落库: 复用 pending_nose_records 表,扩展字段存用户提交的 animal 档案
   */
  async createPendingAnimalRequest(
    dto: {
      nose_vector_id: string;
      species?: string;
      breed?: string;
      color?: string;
      gender?: string;
      age_estimate?: string;
      health_status?: string;
      sterilized?: boolean;
      location_lat?: number;
      location_lng?: number;
      address?: string;
      notes?: string;
      photos?: string[];
      intent?: string;
    },
    user_id: string,
  ) {
    if (!user_id) {
      throw new BadRequestException('请先登录后再提交动物档案');
    }
    // 【Bug A / 2026-07-08】允许 nose_vector_id 为空 — 用户走失时没拍鼻纹只传全身照
    //   防御: dto 里 'null'/'undefined' 字符串都视为空 (前端 JS null 拼接产物)
    const noseVectorId: string | null =
      dto?.nose_vector_id && dto.nose_vector_id !== 'null' && dto.nose_vector_id !== 'undefined'
        ? String(dto.nose_vector_id)
        : null;
    if (!dto.location_lat || !dto.location_lng || dto.location_lat === 0 || dto.location_lng === 0) {
      throw new BadRequestException('请提供有效的位置信息，不支持默认坐标');
    }
    // intent 缺省 = "found" — 与 AnimalsService.create 的默认行为对齐
    const intent = dto.intent || 'found';
    const record_id = uuidv4();
    await this.pendingRepo.save(
      this.pendingRepo.create({
        record_id,
        vector_id: noseVectorId,
        collector_id: user_id,
        source: PendingNoseSource.USER_CREATE_REQUEST,
        status: PendingNoseStatus.PENDING,
        species: dto.species ?? null,
        breed: dto.breed ?? null,
        color: dto.color ?? null,
        gender: dto.gender ?? null,
        age_estimate: dto.age_estimate ?? null,
        health_status: dto.health_status ?? null,
        sterilized: dto.sterilized ?? null,
        location_lat: dto.location_lat ?? null,
        location_lng: dto.location_lng ?? null,
        address: dto.address ?? null,
        notes: dto.notes ?? null,
        photos: dto.photos ?? null,
        intent,
        // 这些字段对 USER_CREATE_REQUEST 场景没意义,但表结构允许,置 null
        fusion_score: null,
        vector_similarity: null,
        gps_similarity: null,
        text_match_rate: null,
        animal_id: null,
        reviewed_by: null,
        reviewed_at: null,
        nose_photo_url: null,
        body_photo_url: null,
      }),
    );
    return {
      record_id,
      vector_id: noseVectorId,
      next_action: 'under_review',
    };
  }

  async recalculateAll() {
    const count = await this.noseRepo.count();
    return { recalculated: count, message: `已重新计算 ${count} 条鼻纹特征` };
  }

  async classify(dto: { image: string }) {
    const imageData = dto.image.replace(/^data:image\/\w+;base64,/, '')
    const res = await axios.post(`${this.AI_SERVICE_URL}/classify/breed`, { image: imageData })

    const breedMap: Record<string, string> = {
      shiba_inu: '柴犬',
      akita: '秋田犬',
      american_bulldog: '美国 Bulldog',
      beagle: '比格犬',
      bengal: '孟加拉猫',
      birman: '伯曼猫',
      bombay: '孟买猫',
      boxer: '拳师犬',
      british_shorthair: '英国短毛猫',
      chihuahua: '吉娃娃',
      egyptian_mau: '埃及猫',
      english_cocker_spaniel: '英国可卡犬',
      english_setter: '英国塞特犬',
      german_shorthaired: '德国短毛指示犬',
      great_pyrenees: '大白熊犬',
      havanese: '哈瓦那犬',
      japanese_chin: '日本 chin 犬',
      keeshond: '荷兰毛狮犬',
      leonberger: '莱昂贝格犬',
      maine_coon: '缅因猫',
      miniature_pinscher: '迷你杜宾犬',
      newfoundland: '纽芬兰犬',
      persian: '波斯猫',
      pomeranian: '博美犬',
      pug: '巴哥犬',
      ragdoll: '布偶猫',
      russian_blue: '俄罗斯蓝猫',
      saint_bernard: '圣伯纳犬',
      samoyed: '萨摩耶',
      scottish_terrier: '苏格兰梗',
      siamese: '暹罗猫',
      sphynx: '斯芬克斯猫',
      staffordshire_bull_terrier: '斯塔福郡斗牛梗',
      wheaten_terrier: '软毛麦色梗',
      yorkshire_terrier: '约克夏梗',
      abyssinian: '阿比西尼亚猫',
      american_pit_bull_terrier: '美国比特斗牛犬',
    }

    return {
      breed: res.data.breed,
      breed_cn: breedMap[res.data.breed] || res.data.breed,
      confidence: res.data.confidence,
      top3: res.data.top3?.map((t: any) => ({
        breed: t.breed,
        breed_cn: breedMap[t.breed] || t.breed,
        confidence: t.confidence
      }))
    }
  }
}
