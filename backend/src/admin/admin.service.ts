import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RescueEvent } from '../events/entities/event.entity';
import { Claim } from '../claims/entities/claim.entity';
import { Animal } from '../animals/entities/animal.entity';
import { User } from '../users/entities/user.entity';
import { EventsService } from '../events/events.service';

// 阶段 2 (2026-07-06): admin 端动作集 — 4 个合法动作
// 【2026-07-09 重构】删除 'confirm' 别名,与 'merge' 行为重复,UI 改用 'merge'
export type AdminEventAction = 'reject' | 'merge' | 'create_new';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    @InjectRepository(Claim) private readonly claimRepo: Repository<Claim>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    // 阶段 2: 注入 EventsService 用于 action='create_new' 派发
    private readonly eventsService: EventsService,
  ) {}

  async stats() {
    const totalAnimals = await this.animalRepo.count();
    const lostAnimals = await this.animalRepo.count({ where: { status: 'lost' as any } });
    const foundAnimals = await this.animalRepo.count({ where: { status: 'found' as any } });
    const claimedAnimals = await this.animalRepo.count({ where: { status: 'claimed' as any } });
    const pendingEvents = await this.eventRepo.count({ where: { status: 'pending' as any } });
    const pendingClaims = await this.claimRepo.count({ where: { status: 'pending' as any } });
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const todayReports = await this.eventRepo.createQueryBuilder('e').where('e.created_at >= :today', { today: todayStr }).andWhere('e.created_at < :tomorrow', { tomorrow: tomorrowStr }).getCount();
    const todayResolved = await this.eventRepo.createQueryBuilder('e').where('e.created_at >= :today', { today: todayStr }).andWhere('e.created_at < :tomorrow', { tomorrow: tomorrowStr }).andWhere('e.status IN (:...status)', { status: ['resolved','confirmed','linked'] }).getCount();
    return { totalAnimals, lostAnimals, foundAnimals, claimedAnimals, pendingEvents, pendingClaims, todayReports, todayResolved, todayProcessing: todayReports - todayResolved };
  }

  async getEvents(query: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.eventRepo.createQueryBuilder('e');
    if (status) qb.andWhere('e.status = :status', { status });
    const [list, total] = await qb.orderBy('e.created_at','DESC').skip((page-1)*limit).take(limit).getManyAndCount();
    return { total, list };
  }

  async getEventDetail(event_id: string) {
    const event = await this.eventRepo.findOne({ where: { event_id } });
    if (!event) throw new Error('Event not found');

    // 基础字段映射
    const base = {
      event_id: event.event_id,
      event_type: event.event_type,
      status: event.status,
      description: event.description,
      address: event.address,
      location_lat: event.location_lat,
      location_lng: event.location_lng,
      occurred_at: event.occurred_at,
      photos: event.photos || [],
      fusion_score: event.fusion_score ?? null,
      vector_similarity: event.vector_similarity ?? null,
      gps_similarity: event.gps_similarity ?? null,
      image_similarity: event.image_similarity ?? null,  // 字段保留, 永远 null (2026-06-13 决定)
      text_match_rate: event.text_match_rate ?? null,
      time_score: event.time_score ?? null,  // report 流字段
      reporter_id: event.reporter_id,
      created_at: event.created_at,
      animal_id: event.animal_id || null,
      // report 流程的结构化字段 (提升文本匹配分数)
      species: event.species || null,
      breed: event.breed || null,
      color: event.color || null,
      gender: event.gender || null,
    };

    // 如果有 candidates 候选列表，进行精细化拼装
    if (event.candidates && event.candidates.length > 0) {
      const animalIds = event.candidates.map((c: any) => c.animal_id).filter(Boolean);
      const animals = animalIds.length > 0
        ? await this.animalRepo.createQueryBuilder('a').where('a.animal_id IN (:...ids)', { ids: animalIds }).getMany()
        : [];
      const animalMap = new Map(animals.map((a: any) => [a.animal_id, a]));

      const candidates = event.candidates.map((c: any) => {
        const animal = animalMap.get(c.animal_id);
        return {
          animal_id: c.animal_id,
          breed: animal?.breed || c.breed || '',
          color: animal?.color || c.color || '',
          gender: animal?.gender || c.gender || '',
          status: animal?.status || c.status || '',
          photos: animal?.photos || c.photos || [],
          address: animal?.address || c.address || '',
          fusion_score: c.fusion_score,
          scores: {
            // 从 candidates[].scores 读取 (events.service 写在那里), 兼容老数据 (顶层)
            // 采集流: vector_similarity 有值, time_score 为 null
            // 上报流: vector_similarity 为 null, time_score 有值
            vector_similarity: c.scores?.vector_similarity ?? c.vector_similarity ?? null,
            gps_similarity: c.scores?.gps_similarity ?? c.gps_similarity ?? null,
            text_match_rate: c.scores?.text_match_rate ?? c.text_match_rate ?? null,
            time_score: c.scores?.time_score ?? c.time_score ?? null,
            image_similarity: c.scores?.image_similarity ?? c.image_similarity ?? null,  // 永远 null (2026-06-13 决定)
            // 兼容旧字段名 (admin 端使用)
            cosine_similarity: c.scores?.vector_similarity ?? c.vector_similarity ?? null,
            gps_score: c.scores?.gps_similarity ?? c.gps_similarity ?? null,
            distance_m: c.scores?.distance_m ?? c.distance_m ?? null,
          },
          is_recommended: c.is_recommended || false,
        };
      });

      return { ...base, candidates };
    }

    return { ...base, candidates: [] };
  }

  async confirmEvent(event_id: string, animal_id?: string) {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(RescueEvent, { where: { event_id } });
      if (!event) throw new Error('Event not found');

      if (event.event_type === 'report' && !event.animal_id) {
        const now = new Date();
        const animal = new Animal();
        animal.animal_id = uuidv4();
        animal.species = (event.species as any) || 'other';
        animal.breed = event.breed || null;
        animal.color = event.color || null;
        animal.gender = (event.gender as any) || 'unknown';
        animal.status = 'found' as any;
        animal.location_lat = event.location_lat;
        animal.location_lng = event.location_lng;
        animal.address = event.address || null;
        animal.photos = (Array.isArray(event.photos) ? event.photos : [])
          .filter((p: any) => typeof p === 'string' && p && p !== 'undefined' && p !== 'null');
        animal.notes = event.description || null;
        animal.first_seen_at = event.occurred_at || now;
        animal.last_seen_at = event.occurred_at || now;
        const savedAnimal = await manager.save(animal);

        await manager.update(RescueEvent, { event_id }, {
          animal_id: savedAnimal.animal_id,
          status: 'confirmed' as any,
        });
        return savedAnimal;
      }

      if (animal_id) {
        const animal = await manager.findOne(Animal, { where: { animal_id } });
        if (!animal) throw new Error('Animal not found');

        await manager.update(RescueEvent, { event_id }, {
          animal_id,
          status: 'duplicated' as any,
          is_duplicate: true,
        } as any);
      } else {
        await manager.update(RescueEvent, { event_id }, {
          status: 'duplicated' as any,
          is_duplicate: true,
        } as any);
      }

      const updatedEvent = await manager.findOne(RescueEvent, { where: { event_id } });
      return updatedEvent;
    });
  }

  async rejectEvent(event_id: string) {
    await this.eventRepo.update({ event_id }, { status: 'rejected' as any });
  }

  /**
   * 阶段 2 (2026-07-06): admin 端动作派发器 — 闭合 4 个动作
   *
   * 映射:
   *   'reject'     → rejectEvent(event_id): status=rejected
   *   'confirm'    → confirmEvent(event_id, animal_id): status=duplicated + is_duplicate=true
   *   'merge'      → confirmEvent(event_id, animal_id): 别名,与 confirm 行为相同(UI 语义不同)
   *   'create_new' → eventsService.createAnimalFromEvent(event_id): 建 Animal + status=confirmed
   *
   * 参数校验:
   *   - 'confirm'/'merge' 必须传 animal_id (要绑的是哪只动物)
   *   - 'create_new' 不需要 animal_id (语义是新建,不是绑定)
   *   - 'reject' 可选 animal_id (忽略)
   *
   * 错误:
   *   - 未知 action → BadRequestException
   *   - confirm/merge 缺 animal_id → BadRequestException
   */
  async dispatchEventAction(
    event_id: string,
    action: AdminEventAction,
    animal_id?: string,
  ): Promise<{ action: AdminEventAction; event_id: string; animal_id?: string | null }> {
    switch (action) {
      case 'create_new': {
        // 不要求 animal_id (语义是"建新动物",不是"绑现动物")
        const created = await this.eventsService.createAnimalFromEvent(event_id);
        return { action: 'create_new', event_id, animal_id: created.animal_id };
      }
      case 'merge': {
        if (!animal_id) {
          throw new BadRequestException(
            `action="merge" 必须传 animal_id (要绑定的目标动物)`,
          );
        }
        const updated = await this.confirmEvent(event_id, animal_id);
        return { action: 'merge', event_id, animal_id: updated?.animal_id || animal_id };
      }
      case 'reject': {
        await this.rejectEvent(event_id);
        return { action: 'reject', event_id, animal_id: animal_id ?? null };
      }
      default:
        throw new BadRequestException(
          `未知 action "${action}",合法值为: reject | merge | create_new`,
        );
    }
  }

  async getClaims(query: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.claimRepo.createQueryBuilder('c').leftJoinAndSelect('c.claimer','u').leftJoinAndSelect('c.animal','a');
    if (status) qb.andWhere('c.status = :status', { status });
    const [list, total] = await qb.skip((page-1)*limit).take(limit).getManyAndCount();
    return { total, list: list.map(c => ({
      claim_id: c.claim_id, animal_id: c.animal_id, event_id: c.event_id,
      user_id: c.claimer_id, notes: c.notes, status: c.status, created_at: c.created_at,
      user: c.claimer ? { user_id: c.claimer.user_id, nickname: c.claimer.nickname, phone: c.claimer.phone ? c.claimer.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null } : null,
      animal: c.animal ? { animal_id: c.animal.animal_id, species: c.animal.species, breed: c.animal.breed, color: c.animal.color } : null,
    }))};
  }

  async getClaimDetail(claim_id: string) {
    const claim = await this.claimRepo.findOne({ where: { claim_id } });
    if (!claim) throw new Error('Claim not found');
    return claim;
  }

  async approveClaim(claim_id: string, admin_id: string) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager.findOne(Claim, { where: { claim_id } });
      if (!claim) throw new NotFoundException('Claim not found');
      // 状态机: 只允许从 pending 推进, 防止重复审批
      if ((claim.status as string) !== 'pending') {
        throw new BadRequestException(`claim 当前状态为 ${claim.status}, 不可重复审批`);
      }
      await manager.update(Claim, { claim_id }, {
        status: 'approved' as any,
        approved_by: admin_id,
        approved_at: new Date(),
      });
      // 级联: 动物进入 claimed 状态, 与 admin.stats() 统计口径一致
      await manager.update(Animal, { animal_id: claim.animal_id }, { status: 'claimed' as any });
      return { claim_id, animal_id: claim.animal_id, status: 'approved' };
    });
  }

  async rejectClaim(claim_id: string) {
    await this.claimRepo.update({ claim_id }, { status: 'rejected' as any });
  }

  async getUsers(query: { page?: number; limit?: number; role?: string; keyword?: string } = {}) {
    const { page = 1, limit = 20, role, keyword } = query;
    const qb = this.userRepo.createQueryBuilder('u');

    if (role) {
      qb.andWhere('u.role = :role', { role });
    }
    if (keyword) {
      qb.andWhere('(u.nickname LIKE :kw OR u.phone LIKE :kw)', { kw: `%${keyword}%` });
    }

    const [list, total] = await qb
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { total, list };
  }

  async getUserDetail(user_id: string) {
    const user = await this.userRepo.findOne({ where: { user_id } });
    if (!user) throw new Error('User not found');
    return {
      user_id: user.user_id,
      nickname: user.nickname,
      phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      role: user.role,
      created_at: user.created_at,
    };
  }

  async getUserEvents(user_id: string, query: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.eventRepo.createQueryBuilder('e').where('e.reporter_id = :user_id', { user_id });
    if (status) qb.andWhere('e.status = :status', { status });
    const [list, total] = await qb.orderBy('e.created_at','DESC').skip((page-1)*limit).take(limit).getManyAndCount();
    return { total, list };
  }

  async getUserClaims(user_id: string, query: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.claimRepo.createQueryBuilder('c').leftJoinAndSelect('c.animal','a').where('c.claimer_id = :user_id', { user_id });
    if (status) qb.andWhere('c.status = :status', { status });
    const [list, total] = await qb.skip((page-1)*limit).take(limit).getManyAndCount();
    return { total, list: list.map(c => ({
      claim_id: c.claim_id, animal_id: c.animal_id, event_id: c.event_id,
      notes: c.notes, status: c.status, created_at: c.created_at,
      animal: c.animal ? { animal_id: c.animal.animal_id, species: c.animal.species, breed: c.animal.breed, color: c.animal.color } : null,
    }))};
  }

  async getUserAnimals(userId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const events = await this.eventRepo.find({ where: { reporter_id: userId }, select: ['animal_id'] });
    const animalIds = [...new Set(events.map(e => e.animal_id).filter(Boolean))];
    if (animalIds.length === 0) {
      return { total: 0, list: [] };
    }
    const qb = this.animalRepo.createQueryBuilder('a').where('a.animal_id IN (:...animalIds)', { animalIds });
    const [list, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { total, list: list.map(a => ({
      animal_id: a.animal_id,
      status: a.status,
      breed: a.breed,
      color: a.color,
      address: a.address,
    }))};
  }

  async updateUser(user_id: string, data: Partial<User>) {
    await this.userRepo.update({ user_id }, data);
    return this.getUserDetail(user_id);
  }

  // 【2026-07-09 重构】低分鼻纹审核流已废弃
  //   旧: 5 个方法(getPendingNoseRecords/getPendingNoseRecordDetail/approvePendingNoseAsNew/
  //         approvePendingNoseAsDuplicate/rejectPendingNoseRecord)操作 pending_nose_records 表
  //   新: pending_nose_records 表 DROP,所有 collect/createPendingAnimalRequest 入口改写 RescueEvent
  //       admin 审核统一走 dispatchEventAction (3 按钮:reject/merge/create_new)
}
