import { Inject, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RescueEvent, EventType, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { NoseService } from '../nose/nose.service';
import { MatchingService, ReportCandidate } from '../matching/matching.service';
import { AnimalsService } from '../animals/animals.service';
import { Animal } from '../animals/entities/animal.entity';

// 兜底坐标（北京天安门，用于"无任何 GPS 来源"场景；后续用真实坐标覆盖）
const FALLBACK_LAT = 39.9087;
const FALLBACK_LNG = 116.3975;

function isMissingCoord(v: any): boolean {
  return v === undefined || v === null || v === '' || Number(v) === 0 || Number.isNaN(Number(v));
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    private readonly noseService: NoseService,
    private readonly matchingService: MatchingService,
    // 阶段 1 (2026-07-06): 注入 AnimalsService 用于 intent='lost'/'found' 时自动建档
    private readonly animalsService: AnimalsService,
  ) {}

  private async resolveCoords(dto: CreateEventDto): Promise<{ lat: number; lng: number; source: 'request' | 'animal' | 'fallback' }> {
    const reqLat = Number(dto.location_lat);
    const reqLng = Number(dto.location_lng);
    if (!isMissingCoord(reqLat) && !isMissingCoord(reqLng)) {
      return { lat: reqLat, lng: reqLng, source: 'request' };
    }
    if (dto.animal_id) {
      const animal = await this.animalRepo.findOne({ where: { animal_id: dto.animal_id } });
      if (animal && !isMissingCoord(animal.location_lat) && !isMissingCoord(animal.location_lng)) {
        return { lat: Number(animal.location_lat), lng: Number(animal.location_lng), source: 'animal' };
      }
    }
    return { lat: FALLBACK_LAT, lng: FALLBACK_LNG, source: 'fallback' };
  }

  async create(dto: CreateEventDto, user_id: string) {
    const event_id = uuidv4();
    const { lat, lng } = await this.resolveCoords(dto);

    // 阶段 1 (2026-07-06): intent='lost'/'found' + animal_id 缺失 → 自动建档
    // 场景 A/B: 用户上报走失/捡到的动物但还没建过档案 → 自动建一个 Animal 档,事件直接关联
    //   intent='stray_sighting' 不自动建档 (可能多只动物,SightingEvent 不专属一只)
    //   intent='profile_build' 不自动建档 (一般是给已有动物补资料)
    //   animal_id 已传 → 不自动建档 (沿用现有 Animal)
    let resolvedAnimalId = dto.animal_id || undefined;
    if (!resolvedAnimalId && (dto.intent === 'lost' || dto.intent === 'found')) {
      const autoAnimal = await this.animalsService.create({
        ...dto,
        intent: dto.intent,
      } as any);
      resolvedAnimalId = autoAnimal?.animal_id || undefined;
      this.logger.log(
        `[EventsService.create] intent="${dto.intent}" 自动建档 → animal_id=${resolvedAnimalId}`,
      );
    }

    const event = this.eventRepo.create({
      event_id,
      reporter_id: user_id,
      event_type: dto.event_type as EventType || EventType.REPORT,
      location_lat: lat,
      location_lng: lng,
      address: dto.address || undefined,
      description: dto.description || undefined,
      photos: dto.photos || undefined,
      occurred_at: new Date(),
      status: EventStatus.PENDING,
      animal_id: resolvedAnimalId,
      // 注: RescueEvent 实体当前无 intent 列 (schema 升级是阶段 1 后的扩展项)
      // 这里只用 dto.intent 驱动自动建档判断,不入库
      nose_vector_id: dto.nose_vector_id || undefined,
      nose_photo_url: dto.nose_photo_url || undefined,
      species: dto.species,
      breed: dto.breed,
      color: dto.color,

      // 2026-06-26: 多部位取色直接透传

      // ValidationPipe + class-transformer 已校验成 BodyColorDto[]

      body_colors: dto.body_colors ?? null,

      gender: dto.gender,
      // 【Defect 4 / 2026-07-08】持久化 intent — admin 后审 createAnimalFromEvent 需要读取
      intent: dto.intent || null,
    } as Partial<RescueEvent>);
    await this.eventRepo.save(event);

    // BUG-002 修复: 创建事件后异步触发 AI 融合评分 + 自动入候选池
    // 不阻塞 POST /events 响应,500ms 内 processEvent 跑完
    // 失败仅 logger.error,不抛 500 (admin 仍可手动 processEvent 重试)
    // 幂等: processEvent 内 fusion_score 非空时跳过,防 setImmediate + admin 重复触发双重跑
    setImmediate(() => {
      this.processEventSafe(event_id).catch(() => undefined);
    });

    return { event_id, is_duplicate: false, fusion_score: null, status: 'pending' };
  }

  /**
   * BUG-002 修复: processEvent 的安全包装,异步触发时吞掉错误
   * - log error 而非抛错,保证 setImmediate 不会触发 unhandledRejection
   * - admin 仍可通过管理端手动调 processEvent(event_id) 兜底
   */
  private async processEventSafe(event_id: string): Promise<void> {
    try {
      await this.processEvent(event_id);
    } catch (err: any) {
      this.logger.error(`[EventsService.processEventSafe] ${event_id} 异步失败: ${err.message}`, err.stack);
    }
  }

  async findByReporter(reporter_id: string) {
    return this.eventRepo.find({ where: { reporter_id }, order: { created_at: 'DESC' } });
  }

  /**
   * 阶段 2 (2026-07-06): admin 端 create_new 动作 — 从事件字段直接创建动物档
   * 触发场景: admin 拿到 candidates=空 或 fusion<阈值 的事件 → 决定"创建新动物"
   *
   * 字段映射 (event → animal):
   *   species / breed / color / gender → 直接透传
   *   location_lat / location_lng / address → 透传(也可从 dto 再覆盖)
   *   photos → 透传 (event.photos 是 [] 或 string[])
   *   description → notes (Animal 字段名不同)
   *   nose_vector_id → primary_nose_id (走 Stage 1 Bug6 兜底: 自动回填孤儿 NoseFeature)
   *   occurred_at → first_seen_at + last_seen_at
   *   event_id 缺失 → 抛 NotFoundException
   *
   * 副作用:
   *   - event.animal_id ← 新建的 animal.animal_id
   *   - event.status ← EventStatus.CONFIRMED
   *
   * 注意:
   *   - 不传 intent → AnimalsService.create 内部默认 status=LOST (向后兼容, 详见 animal.service.create)
   *   - admin 仍可在 CREATE 之后再用 PUT /admin/animals/:id 调整 status
   *   - 不动 nose_vector_id 本身,只把它作为 primary_nose_id 关联
   */
  async createAnimalFromEvent(event_id: string): Promise<{ animal_id: string; event_id: string }> {
    const event = await this.eventRepo.findOne({ where: { event_id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    this.logger.log(`[EventsService.createAnimalFromEvent] event=${event_id} → 建档 (intent=${event.intent})`);
    const newAnimal = await this.animalsService.create({
      species: event.species,
      breed: event.breed ?? undefined,
      color: event.color ?? undefined,
      gender: event.gender ?? undefined,
      location_lat: event.location_lat,
      location_lng: event.location_lng,
      address: event.address ?? undefined,
      photos: event.photos ?? undefined,
      body_colors: event.body_colors ?? undefined,
      // event.description → Animal.notes
      notes: event.description ?? undefined,
      // event.nose_vector_id → Animal.primary_nose_id
      primary_nose_id: event.nose_vector_id ?? undefined,
      // event.occurred_at → first_seen_at + last_seen_at
      first_seen_at: event.occurred_at ? event.occurred_at.toISOString() : undefined,
      last_seen_at: event.occurred_at ? event.occurred_at.toISOString() : undefined,
      // 【Defect 4 / 2026-07-08】intent 透传 → AnimalsService.create 决定 status
      //   intent=found → AnimalStatus.FOUND;intent=lost/undefined → AnimalStatus.LOST
      intent: event.intent || undefined,
    } as any);

    // 【Defect 4 / 2026-07-08】intent=found → 主动物 status=found + 额外生成一条 lost 记录
    //   场景: 发现页上报"我捡到狗",审核建档后,管理员可能后续想用这只动物触发走失匹配
    //   不重复生成 lost 记录的兜底: 仅 intent=found 时创建
    if (event.intent === 'found') {
      await this.animalsService.create({
        species: event.species,
        breed: event.breed ?? undefined,
        color: event.color ?? undefined,
        gender: event.gender ?? undefined,
        location_lat: event.location_lat,
        location_lng: event.location_lng,
        address: event.address ?? undefined,
        photos: event.photos ?? undefined,
        body_colors: event.body_colors ?? undefined,
        notes: event.description ?? undefined,
        // 不挂 primary_nose_id — lost 记录不需要向量重复
        first_seen_at: event.occurred_at ? event.occurred_at.toISOString() : undefined,
        last_seen_at: event.occurred_at ? event.occurred_at.toISOString() : undefined,
        intent: 'lost',  // 显式 lost
      } as any);
      this.logger.log(`[EventsService.createAnimalFromEvent] intent=found → 额外生成 lost 记录`);
    }

    // 关键副作用: event.animal_id 指向新动物, status=confirmed (与 confirmEvent 区分)
    // confirmEvent status=duplicated + is_duplicate=true; create_new status=confirmed
    await this.eventRepo.update(
      { event_id },
      {
        animal_id: newAnimal.animal_id,
        status: EventStatus.CONFIRMED,
      },
    );

    this.logger.log(
      `[EventsService.createAnimalFromEvent] event=${event_id} → animal_id=${newAnimal.animal_id}`,
    );
    return { animal_id: newAnimal.animal_id, event_id };
  }

  /**
   * 阶段 3 (2026-07-06): 用户自助关联事件到动物
   * - 权限: 仅事件 reporter 本人可关联 (与 admin dispatchEventAction 隔离)
   * - 行为: event.animal_id ← 传入 animal_id; status 保持 PENDING
   *   (self-service 入口, 不直接 confirmed; 走 admin 二次确认)
   * - 校验: 事件存在 + reporter 匹配 + 目标动物存在
   */
  async linkToAnimal(event_id: string, animal_id: string, user_id: string) {
    const event = await this.eventRepo.findOne({ where: { event_id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.reporter_id !== user_id) {
      throw new ForbiddenException('只能关联自己上报的事件');
    }
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) throw new NotFoundException('Animal not found');

    await this.eventRepo.update(
      { event_id },
      { animal_id, status: EventStatus.PENDING },
    );
    this.logger.log(`[EventsService.linkToAnimal] event=${event_id} → animal=${animal_id} (self-service, pending)`);
    return { event_id, animal_id, status: 'pending' };
  }

  async findAll(query: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.eventRepo.createQueryBuilder('e');
    if (status) qb.andWhere('e.status = :status', { status });
    const [list, total] = await qb.orderBy('e.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { total, list };
  }

  async confirm(event_id: string) {
    await this.eventRepo.update({ event_id }, { status: EventStatus.DUPLICATED, is_duplicate: true });
  }

  async reject(event_id: string) {
    await this.eventRepo.update({ event_id }, { status: EventStatus.REJECTED });
  }

  async processEvent(event_id: string) {
    try {
      const event = await this.eventRepo.findOne({ where: { event_id } });
      if (!event) throw new Error('Event not found');

      // BUG-002 修复: 幂等保护 — fusion_score 已写入说明已 process 过
      // 触发场景: (a) create() setImmediate 自动触发后 admin 又手动点 process
      //          (b) admin 重复点按钮
      // 跳过能避免: 重复跑 AI 推理、重复生成 candidates、eventRepo.update 把 fusion_score 覆写成旧值
      if (event.fusion_score !== null && event.fusion_score !== undefined) {
        this.logger.log(`[EventsService.processEvent] 事件 ${event_id} 已处理过(fusion=${event.fusion_score}),跳过`);
        return {
          event_id,
          status: event.status,
          fusion_score: Number(event.fusion_score),
          candidates_count: 0,
          matching_mode: event.nose_vector_id ? 'nose' : 'report',
          message: '已处理,跳过',
        };
      }

      // 分支: collect(有鼻纹) vs report(无鼻纹) 走完全不同的 AI 匹配管道
      // 原因: 鼻纹向量是 128-dim 特征, 只有采集过的动物才有; report 事件根本没采过鼻纹
      let candidates: any[] = [];
      let scores: { vector?: number | null; gps?: number; text?: number; time?: number; image?: number | null; fusion: number | null } = {
        fusion: null,
      };

      if (event.nose_vector_id) {
        // === Collect 流程: 用鼻纹向量比对所有 primary_nose_id 非空的动物 ===
        this.logger.log(`[EventsService.processEvent] 事件 ${event_id} 走鼻纹 AI 匹配 (nose_vector_id=${event.nose_vector_id})`);
        // 把事件的位置/品种/颜色/性别一起传入, 让 compare 内部做加权融合 (vector 0.5 + gps 0.3 + text 0.2)
        const compareResult = await this.noseService.compare(
          {
            vector_id: event.nose_vector_id,
            location_lat: event.location_lat ? Number(event.location_lat) : undefined,
            location_lng: event.location_lng ? Number(event.location_lng) : undefined,
            breed: event.breed,
            color: event.color,
            gender: event.gender,
          } as any,
          event.reporter_id,
        );
        candidates = compareResult.results.map((r: any) => ({
          animal_id: r.animal_id,
          breed: r.animal?.breed || '',
          color: r.animal?.color || '',
          gender: r.animal?.gender || '',
          status: r.animal?.status || '',
          photos: r.animal?.photos || [],
          address: r.animal?.address || '',
          fusion_score: r.fusion_score,
          scores: {
            vector_similarity: r.vector_similarity,
            // 直接使用 compare 已算好的 0~1 分, 避免公式不一致
            gps_similarity: r.gps_similarity ?? 0,
            text_match_rate: r.text_match_rate,
          },
          is_recommended: r.is_recommended || false,
        }));
        scores = {
          // BUG-006 修复: vector_similarity 字段在 candidate.scores 下,不在 candidate 顶层
          vector: candidates[0]?.scores?.vector_similarity ?? null,
          gps: candidates[0]?.scores?.gps_similarity ?? null,
          text: candidates[0]?.scores?.text_match_rate ?? null,
          image: null,
          fusion: candidates[0]?.fusion_score ?? null,
        };
      } else {
        // === Report 流程: 不用鼻纹! 改用 image+GPS+text+time 匹配 lost 动物 ===
        this.logger.log(`[EventsService.processEvent] 事件 ${event_id} 走上报 AI 匹配 (无鼻纹, 用图片+GPS+文本+时间)`);
        const reportCandidates: ReportCandidate[] = await this.matchingService.findSimilarLostAnimalsForReport(event, 5);
        candidates = reportCandidates.map(c => ({
          animal_id: c.animal_id,
          breed: c.breed,
          color: c.color,
          gender: c.gender,
          status: c.status,
          photos: c.photos,
          address: c.address,
          fusion_score: c.fusion_score,
          scores: {
            image_similarity: c.scores.image_similarity,
            gps_similarity: c.scores.gps_similarity,
            text_match_rate: c.scores.text_match_rate,
            time_score: c.scores.time_score,
            distance_m: c.distance_m,
          },
          is_recommended: c.is_recommended,
        }));
        scores = {
          vector: null,  // 关键: report 流程无鼻纹, 永远 null
          gps: reportCandidates[0]?.scores.gps_similarity ?? null,
          text: reportCandidates[0]?.scores.text_match_rate ?? null,
          time: reportCandidates[0]?.scores.time_score ?? null,
          image: reportCandidates[0]?.scores.image_similarity ?? null,  // 永远 null (字段保留)
          fusion: reportCandidates[0]?.fusion_score ?? null,
        };
      }

      // ========== 【2026-07-09 重构】机器只算 hint,不自动合段 ==========
      // 移除旧 Bug6 候选池方案中的 fusion_score>=0.8 自动写 is_duplicate/duplicate_of/animal_id
      // 新策略:
      //   - 计算 candidates + fusion_score 写入事件(给 admin 决策提供 hint)
      //   - 不修改 animal_id / is_duplicate / duplicate_of(保持原值,等 admin 调 dispatchEventAction)
      //   - 仍剔除 candidates 中的 self-merge(BUG-005/007),仅影响 fusion_score 写入的取值,不自动合段
      let topFusion = scores.fusion;
      let topCandidate = candidates[0];
      if (event.animal_id) {
        const filtered = candidates.filter(
          (c: any) => c.animal_id && c.animal_id !== event.animal_id,
        );
        if (filtered.length > 0) {
          topCandidate = filtered[0];
          topFusion = topCandidate?.fusion_score ?? null;
          this.logger.log(
            `[EventsService.processEvent] 事件 ${event_id} 剔除 self-merge 候选 ` +
            `(原 top1=${candidates[0]?.animal_id}),实际 top1=${topCandidate.animal_id}, fusion=${topFusion}`,
          );
        } else {
          topCandidate = null;
          topFusion = null;
          this.logger.log(
            `[EventsService.processEvent] 事件 ${event_id} 候选池仅含自身,跳过 hint 回填`,
          );
        }
      }

      const updatePayload: any = {
        status: EventStatus.PENDING,
        fusion_score: topFusion,
        vector_similarity: scores.vector ?? null,
        gps_similarity: scores.gps ?? null,
        image_similarity: scores.image ?? null,  // 永远 null (字段保留, 永远不用)
        text_match_rate: scores.text ?? null,
        time_score: (scores as any).time ?? null,  // 仅 report 流程使用
        candidates: candidates as any,
        // is_duplicate / duplicate_of / animal_id 不再自动设置
        // admin 通过 dispatchEventAction(action='merge', animal_id) 手动合段
      };

      await this.eventRepo.update({ event_id }, updatePayload as any);

      return {
        event_id,
        status: 'pending',
        fusion_score: topFusion,
        candidates_count: candidates.length,
        matching_mode: event.nose_vector_id ? 'nose' : 'report',
        message: event.nose_vector_id ? '鼻纹 AI 比对完成' : '上报 AI 比对完成',
        // 【2026-07-09 重构】merge_candidate 字段废弃:机器不决策,只给 hint
        hint_candidate: topCandidate ? {
          animal_id: topCandidate.animal_id,
          fusion_score: topFusion,
        } : null,
      };
    } catch (err) {
      this.logger.error(`[EventsService.processEvent] ERROR: ${err.message}`, err.stack);
      throw err;
    }
  }
}

