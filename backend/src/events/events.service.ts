import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RescueEvent, EventType, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { NoseService } from '../nose/nose.service';
import { MatchingService, ReportCandidate } from '../matching/matching.service';
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
      animal_id: dto.animal_id || undefined,
      nose_vector_id: dto.nose_vector_id || undefined,
      nose_photo_url: dto.nose_photo_url || undefined,
      species: dto.species,
      breed: dto.breed,
      color: dto.color,

      // 2026-06-26: 多部位取色直接透传

      // ValidationPipe + class-transformer 已校验成 BodyColorDto[]

      body_colors: dto.body_colors ?? null,

      gender: dto.gender,
    } as Partial<RescueEvent>);
    await this.eventRepo.save(event);
    return { event_id, is_duplicate: false, fusion_score: null, status: 'pending' };
  }

  async findByReporter(reporter_id: string) {
    return this.eventRepo.find({ where: { reporter_id }, order: { created_at: 'DESC' } });
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
          vector: candidates[0]?.vector_similarity ?? null,
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

      const topFusion = scores.fusion;

      // ========== Bug6 修复: 候选池方案 ==========
      // 当 fusion_score >= 0.8 且 top candidate 有 animal_id,
      //   自动设置 is_duplicate/duplicate_of/animal_id 入候选池,
      //   status 保持 PENDING(等 admin 在事件合并页二次确认后调 confirmEvent 转 duplicated)
      const CANDIDATE_POOL_THRESHOLD = 0.8;
      const topCandidate = candidates[0];
      const isMergeCandidate =
        topFusion != null &&
        topFusion >= CANDIDATE_POOL_THRESHOLD &&
        topCandidate?.animal_id;

      const updatePayload: any = {
        status: EventStatus.PENDING,
        fusion_score: topFusion,
        vector_similarity: scores.vector ?? null,
        gps_similarity: scores.gps ?? null,
        image_similarity: scores.image ?? null,  // 永远 null (字段保留, 永远不用)
        text_match_rate: scores.text ?? null,
        time_score: (scores as any).time ?? null,  // 仅 report 流程使用
        candidates: candidates as any,
      };
      if (isMergeCandidate) {
        updatePayload.is_duplicate = true;
        updatePayload.duplicate_of = topCandidate.animal_id;
        updatePayload.animal_id = topCandidate.animal_id;
        this.logger.log(
          `[EventsService.processEvent] 事件 ${event_id} 入候选池: ` +
          `fusion=${topFusion}, target_animal=${topCandidate.animal_id}`
        );
      }

      await this.eventRepo.update({ event_id }, updatePayload as any);

      return {
        event_id,
        status: 'pending',
        fusion_score: topFusion,
        candidates_count: candidates.length,
        matching_mode: event.nose_vector_id ? 'nose' : 'report',
        message: event.nose_vector_id ? '鼻纹 AI 比对完成' : '上报 AI 比对完成',
        merge_candidate: isMergeCandidate ? {
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

