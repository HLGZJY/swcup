import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Animal, AnimalStatus, Species } from './entities/animal.entity';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/create-animal.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AnimalsService {
  constructor(@InjectRepository(Animal) private readonly animalRepo: Repository<Animal>) {}

  async findAll(query: { page?: number; limit?: number; species?: string; status?: string; keyword?: string }) {
    const { page = 1, limit = 20, species, status, keyword } = query;
    const qb = this.animalRepo.createQueryBuilder('a');
    if (species) qb.andWhere('a.species = :species', { species });
    if (status) qb.andWhere('a.status = :status', { status });
    if (keyword) {
      qb.andWhere('(a.breed LIKE :kw OR a.color LIKE :kw OR a.address LIKE :kw)', { kw: `%${keyword}%` });
    }
    const [list, total] = await qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { total, list };
  }

  async findOne(id: string) {
    const animal = await this.animalRepo.findOne({ where: { animal_id: id } });
    if (!animal) throw new NotFoundException('动物不存在');
    return animal;
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
        status: AnimalStatus.LOST,
      } as Partial<Animal>);
      return await this.animalRepo.save(animal);
    } catch (err) {
      console.error('[AnimalsService.create] ERROR:', err.message);
      throw err;
    }
  }

  async update(id: string, dto: UpdateAnimalDto) {
    const animal = await this.findOne(id);
    const updated = {
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
    } as Partial<Animal>;
    Object.assign(animal, updated);
    return this.animalRepo.save(animal);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.animalRepo.delete({ animal_id: id });
  }
}