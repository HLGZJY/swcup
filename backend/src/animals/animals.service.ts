import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Animal, AnimalStatus, Species } from './entities/animal.entity';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/create-animal.dto';
import { CreateSightingDto } from './dto/create-sighting.dto';
import { NoseFeature } from '../nose/entities/nose-feature.entity';
import { RescueEvent, EventType } from '../events/entities/event.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AnimalsService {
  private readonly logger = new Logger(AnimalsService.name);

  constructor(
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    // 注入 NoseFeature repo 用于建档时回填孤儿记录
    @InjectRepository(NoseFeature) private readonly noseRepo: Repository<NoseFeature>,
    // Bug5 修复: 注入 RescueEvent repo 用于查询 report_count
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
  ) {}

  async findAll(query: { page?: number; limit?: number; species?: string; status?: string; keyword?: string; include_archived?: boolean | string }) {
    const { page = 1, limit = 20, species, status, keyword, include_archived } = query;
    const qb = this.animalRepo.createQueryBuilder('a');
    if (species) qb.andWhere('a.species = :species', { species });
    if (status) qb.andWhere('a.status = :status', { status });
    if (status !== 'archived' && (!include_archived || include_archived === 'false')) {
      qb.andWhere('a.status != :archived', { archived: 'archived' });
    }
    if (keyword) {
      qb.andWhere('(a.breed LIKE :kw OR a.color LIKE :kw OR a.address LIKE :kw)', { kw: `%${keyword}%` });
    }
    const [list, total] = await qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();

    // Bug5 修复: 单独查每个 animal 的事件数,再 merge
    // 原因: TypeORM 的 addSelect(sub) 在 getMany() 时不会 hydration 到 entity,
    //       必须 getRawMany() 才能拿到,但又不想放弃 entity hydration,
    //       所以拆成两个查询,内存里 O(1) 合
    const ids = list.map((a) => a.animal_id);
    let countMap = new Map<string, number>();
    if (ids.length > 0) {
      const rows: any[] = await this.eventRepo
        .createQueryBuilder('e')
        .select('e.animal_id', 'animal_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('e.animal_id IN (:...ids)', { ids })
        .groupBy('e.animal_id')
        .getRawMany();
      countMap = new Map(rows.map((r) => [r.animal_id, Number(r.cnt) || 0]));
    }

    const listWithCount = list.map((a: any) => ({
      ...a,
      report_count: countMap.get(a.animal_id) || 0,
    }));
    return { total, list: listWithCount };
  }

  async findOne(id: string) {
    const animal = await this.animalRepo.findOne({ where: { animal_id: id } });
    if (!animal) throw new NotFoundException('动物不存在');
    // Bug5 修复: 单个 animal 详情也带 report_count
    const count = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.animal_id = :aid', { aid: id })
      .getCount();
    return {
      ...animal,
      report_count: count,
    };
  }

  async create(dto: CreateAnimalDto) {
    try {
      const animal = this.animalRepo.create({
        animal_id: uuidv4(),
        species: dto.species as Species,
        breed: dto.breed,
        color: dto.color,
        gender: dto.gender,
        age_estimate: dto.age_estimate,
        health_status: dto.health_status,
        sterilized: dto.sterilized,
        first_seen_at: dto.first_seen_at ? new Date(dto.first_seen_at) : new Date(),
        last_seen_at: dto.last_seen_at ? new Date(dto.last_seen_at) : new Date(),
        location_lat: Number(dto.location_lat) || 0,
        location_lng: Number(dto.location_lng) || 0,
        address: dto.address,
        notes: dto.notes,
        tags: dto.tags,
        photos: dto.photos,

        // 2026-06-26: 多部位取色直接透传

        // ValidationPipe + class-transformer 已校验成 BodyColorDto[]

        body_colors: dto.body_colors ?? null,
        // Bug6 修复: 必须把 nose 采集的 vector_id 关联到 animal.primary_nose_id
        // 否则 nose.service.collect() 的 findSimilarAnimals() SQL
        //   WHERE a.primary_nose_id IS NOT NULL
        // 会把所有 Animal 过滤掉, 同图二次采集永远查不到重复
        primary_nose_id: dto.primary_nose_id,
        // 阶段 1 (2026-07-06): status 由 dto.intent 决定
        //   intent='found' → AnimalStatus.FOUND (捡到)
        //   intent='lost' | undefined | 'unknown' → AnimalStatus.LOST (默认走失, 向后兼容)
        status: dto.intent === 'found' ? AnimalStatus.FOUND : AnimalStatus.LOST,
      } as Partial<Animal>);
      const saved = await this.animalRepo.save(animal);

      // Bug6 兜底修复: 建档时回填所有 vector_id=dto.primary_nose_id 且 animal_id=NULL 的孤儿 NoseFeature
      // 场景: 用户先采鼻纹(产生孤儿 NoseFeature)→ 后建档(此时 dto.primary_nose_id 指向那个孤儿)
      // 之前: 孤儿 NoseFeature.animal_id 永远是 NULL, 后续 collect 时 findSimilarAnimals 找不到这个动物
      // 现在: 建档时一次性把所有同 vector_id 的孤儿回填, 保证数据一致性
      if (dto.primary_nose_id) {
        const backfill = await this.noseRepo.update(
          { vector_id: dto.primary_nose_id, animal_id: IsNull() },
          { animal_id: saved.animal_id },
        );
        if (backfill.affected && backfill.affected > 0) {
          this.logger.log(
            `[AnimalsService.create] 回填 ${backfill.affected} 条孤儿 NoseFeature.animal_id -> ${saved.animal_id} (vector_id=${dto.primary_nose_id})`,
          );
        }
      }

      return saved;
    } catch (err) {
      console.error('[AnimalsService.create] ERROR:', err.message);
      throw err;
    }
  }

  async update(id: string, dto: UpdateAnimalDto) {
    const animal = await this.findOne(id);
    const updated = {
      // status 必须放在最前:之前漏掉,导致 {status:'archived'|'claimed'} 这类纯状态更新是静默 no-op
      // 这里只允许白名单值,非法值会被 NestJS enum 校验在 DB 层抛错
      status: dto.status ? dto.status as AnimalStatus : animal.status,
      species: dto.species ? dto.species as Species : animal.species,
      breed: dto.breed ?? animal.breed,
      color: dto.color ?? animal.color,
      gender: dto.gender ?? animal.gender,
      age_estimate: dto.age_estimate ?? animal.age_estimate,
      health_status: dto.health_status ?? animal.health_status,
      sterilized: dto.sterilized ?? animal.sterilized,
      first_seen_at: dto.first_seen_at ? new Date(dto.first_seen_at) : animal.first_seen_at,
      last_seen_at: dto.last_seen_at ? new Date(dto.last_seen_at) : animal.last_seen_at,
      location_lat: dto.location_lat ? Number(dto.location_lat) : animal.location_lat,
      location_lng: dto.location_lng ? Number(dto.location_lng) : animal.location_lng,
      address: dto.address ?? animal.address,
      notes: dto.notes ?? animal.notes,
      tags: dto.tags ?? animal.tags,
      photos: dto.photos ?? animal.photos,

      // 2026-06-26: body_colors

      // - undefined → 没传, 保留原值

      // - null       → 显式清空 (PATCH 把多色回退到简单模式)

      // - Array      → 替换

      body_colors: dto.body_colors === undefined ? animal.body_colors : dto.body_colors,
    } as Partial<Animal>;
    Object.assign(animal, updated);
    return this.animalRepo.save(animal);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.animalRepo.delete({ animal_id: id });
  }

  /**
   * 阶段 3 (2026-07-06): 动物时间轴
   * - 不增表: 直接查 rescue_events.animal_id = :id, occurred_at DESC, LIMIT 100
   * - reporter 只暴露 nickname (User 无 avatar 列; 且隐私要求不泄露 user_id)
   * - intent 由 event_type 派生 (阶段 4 才持久化 intent 列)
   * - 任意登录用户可看 (controller 级 JwtAuthGuard, 无 @Public)
   */
  async getTimeline(animal_id: string) {
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) throw new NotFoundException('动物不存在');

    const events = await this.eventRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.reporter', 'u')
      .where('e.animal_id = :animal_id', { animal_id })
      .orderBy('e.occurred_at', 'DESC')
      .take(100)
      .getMany();

    return {
      animal_id,
      total: events.length,
      events: events.map((e) => ({
        event_id: e.event_id,
        reporter: e.reporter ? { nickname: e.reporter.nickname } : null,
        occurred_at: e.occurred_at,
        address: e.address ?? null,
        location_lat: e.location_lat ?? null,
        location_lng: e.location_lng ?? null,
        photos: e.photos || [],
        description: e.description ?? null,
        intent: this.deriveIntent(e),
        status: e.status,
      })),
    };
  }

  /**
   * intent 派生规则 (阶段 4 加 intent 列后需同步更新此处)
   * TODO(阶段 4): 若 event.intent 已持久化, 优先返回 event.intent
   */
  private deriveIntent(event: RescueEvent): string {
    if (event.event_type === EventType.COLLECT) return 'profile_build';
    if (event.event_type === EventType.REPORT) return 'stray_sighting';
    return 'unknown';
  }

  /**
   * 【2026-07-09】二次目击端点 — POST /animals/:animal_id/sightings
   *
   * 区别于"上报走失"(POST /events 入审核流):
   *   - 仅更新 animal.last_seen_at / address 等最近目击信息
   *   - 不创建 rescue_event,不入审核流,不刷新 admin 审核列表
   *   - 用户在 animal-detail 详情页点"我看到了它" → 直接调此接口
   */
  async recordSighting(animal_id: string, dto: CreateSightingDto): Promise<Animal> {
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) {
      throw new NotFoundException(`Animal ${animal_id} not found`);
    }
    const seenAt = dto.seen_at ? new Date(dto.seen_at) : new Date();
    animal.last_seen_at = seenAt;
    if (dto.address) {
      animal.address = dto.address;
    }
    if (dto.photos?.length) {
      animal.photos = dto.photos;
    }
    return this.animalRepo.save(animal);
  }
}

