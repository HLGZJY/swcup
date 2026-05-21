import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RescueEvent, EventType, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { NoseService } from '../nose/nose.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    private readonly noseService: NoseService,
  ) {}

  async create(dto: CreateEventDto, user_id: string) {
    const event_id = uuidv4();
    const event = this.eventRepo.create({
      event_id,
      reporter_id: user_id,
      event_type: dto.event_type as EventType || EventType.REPORT,
      location_lat: Number(dto.location_lat),
      location_lng: Number(dto.location_lng),
      address: dto.address || undefined,
      description: dto.description || undefined,
      photos: dto.photos || undefined,
      occurred_at: new Date(),
      status: EventStatus.PENDING,
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

      // 触发 AI 比对（使用事件的鼻纹照片 URL）
      const compareResult = await this.noseService.compare(
        { nose_photo_url: event.nose_photo_url } as any,
        event.reporter_id,
      );

      const candidates = compareResult.results.map((r: any) => ({
        animal_id: r.animal_id,
        breed: r.animal?.breed || '',
        color: r.animal?.color || '',
        gender: r.animal?.gender || '',
        status: r.animal?.status || '',
        photos: r.animal?.photos || [],
        address: r.animal?.address || '',
        fusion_score: r.fusion_score,
        vector_similarity: r.vector_similarity,
        gps_similarity: r.gps_distance_m ? parseFloat((1 - r.gps_distance_m / 5000).toFixed(4)) : 0,
        image_similarity: r.image_similarity,
        text_match_rate: r.text_match_rate,
        is_recommended: r.is_recommended || false,
      }));

      const topFusionScore = candidates.length > 0 ? candidates[0].fusion_score : null;

      await this.eventRepo.update({ event_id }, {
        status: EventStatus.PENDING,
        fusion_score: topFusionScore,
        vector_similarity: candidates.length > 0 ? candidates[0].vector_similarity : null,
        gps_similarity: candidates.length > 0 ? candidates[0].gps_similarity : null,
        image_similarity: candidates.length > 0 ? candidates[0].image_similarity : null,
        text_match_rate: candidates.length > 0 ? candidates[0].text_match_rate : null,
        candidates: candidates as any,
      } as any);

      return {
        event_id,
        status: 'pending',
        fusion_score: topFusionScore,
        candidates_count: candidates.length,
        message: 'AI比对完成',
      };
    } catch (err) {
      console.error('[EventsService.processEvent] ERROR:', err.message);
      throw err;
    }
  }
}
