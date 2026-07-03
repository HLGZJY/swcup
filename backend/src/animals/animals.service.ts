import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Animal, AnimalStatus, Species } from './entities/animal.entity';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/create-animal.dto';
import { NoseFeature } from '../nose/entities/nose-feature.entity';
import { RescueEvent } from '../events/entities/event.entity';
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
    // Bug5 修复: 加载每个动物关联的事件数(用于首页"已 N 次上报"展示)
    qb.addSelect((sub) => {
      return sub
        .select('COUNT(*)', 'report_count')
        .from(RescueEvent, 'e')
        .where('e.animal_id = a.animal_id');
    }, 'report_count');
    if (species) qb.andWhere('a.species = :species', { species });
    if (status) qb.andWhere('a.status = :status', { status });
    if (status !== 'archived' && (!include_archived || include_archived === 'false')) {
      qb.andWhere('a.status != :archived', { archived: 'archived' });
    }
    if (keyword) {
      qb.andWhere('(a.breed LIKE :kw OR a.color LIKE :kw OR a.address LIKE :kw)', { kw: `%${keyword}%` });
    }
    const [list, total] = await qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    // report_count 是 string(数据库 SUM/COUNT 返回),统一转 number
    const listWithCount = list.map((a: any) => ({
      ...a,
      report_count: Number(a.report_count) || 0,
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
        status: AnimalStatus.LOST,
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
}

