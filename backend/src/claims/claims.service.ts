import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Claim } from './entities/claim.entity';
import { CreateClaimDto, QueryClaimDto } from './dto/create-claim.dto';

@Injectable()
export class ClaimsService {
  constructor(@InjectRepository(Claim) private readonly claimRepo: Repository<Claim>) {}

  async create(dto: CreateClaimDto, user_id: string) {
    const claim_id = uuidv4();
    const claim = this.claimRepo.create({
      claim_id,
      animal_id: dto.animal_id,
      claimer_id: user_id,
      event_id: dto.event_id || undefined,
      notes: dto.notes || undefined,
      claimed_at: new Date(),
      status: 'pending' as any,
    } as Partial<Claim>);
    await this.claimRepo.save(claim);
    return { claim_id, status: 'pending' };
  }

  async findByClaimer(claimer_id: string) {
    return this.claimRepo.find({ where: { claimer_id }, order: { created_at: 'DESC' } });
  }

  async findAll(query: QueryClaimDto) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.claimRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.claimer', 'u')
      .leftJoinAndSelect('c.animal', 'a');
    if (status) qb.andWhere('c.status = :status', { status });
    const [list, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return {
      total,
      list: list.map(c => ({
        claim_id: c.claim_id,
        animal_id: c.animal_id,
        event_id: c.event_id,
        user_id: c.claimer_id,
        notes: c.notes,
        status: c.status,
        created_at: c.created_at,
        user: c.claimer ? {
          user_id: c.claimer.user_id,
          nickname: c.claimer.nickname,
          phone: c.claimer.phone ? c.claimer.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
        } : null,
        animal: c.animal ? {
          animal_id: c.animal.animal_id,
          species: c.animal.species,
          breed: c.animal.breed,
          color: c.animal.color,
        } : null,
      })),
    };
  }

  async approve(claim_id: string, admin_id: string) {
    await this.claimRepo.update({ claim_id }, { status: 'approved' as any, approved_by: admin_id, approved_at: new Date() });
  }

  async reject(claim_id: string) {
    await this.claimRepo.update({ claim_id }, { status: 'rejected' as any });
  }
}