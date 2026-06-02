import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RescueEvent } from '../events/entities/event.entity';
import { Claim } from '../claims/entities/claim.entity';
import { Animal } from '../animals/entities/animal.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    @InjectRepository(Claim) private readonly claimRepo: Repository<Claim>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
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
      image_similarity: event.image_similarity ?? null,
      text_match_rate: event.text_match_rate ?? null,
      reporter_id: event.reporter_id,
      created_at: event.created_at,
      animal_id: event.animal_id || null,
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
            cosine_similarity: c.vector_similarity ?? null,
            gps_score: c.gps_similarity ?? null,
            text_match_rate: c.text_match_rate ?? null,
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
        animal.species = (event.species as any) || 'other';
        animal.breed = event.breed || null;
        animal.color = event.color || null;
        animal.gender = (event.gender as any) || 'unknown';
        animal.status = 'found' as any;
        animal.location_lat = event.location_lat;
        animal.location_lng = event.location_lng;
        animal.address = event.address || null;
        animal.photos = event.photos || [];
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
    await this.claimRepo.update({ claim_id }, { status: 'approved' as any, approved_by: admin_id, approved_at: new Date() });
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
}
