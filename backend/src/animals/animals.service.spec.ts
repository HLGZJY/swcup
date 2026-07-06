import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { AnimalsService } from './animals.service';
import { Animal, AnimalStatus, Species, Gender } from './entities/animal.entity';
import { NoseFeature } from '../nose/entities/nose-feature.entity';
import { RescueEvent } from '../events/entities/event.entity';

function makeRepo() {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
  };
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => entity),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
  };
}

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    animal_id: 'animal-1',
    status: AnimalStatus.LOST,
    species: Species.DOG,
    breed: 'shiba',
    color: 'yellow',
    gender: Gender.MALE,
    first_seen_at: new Date('2026-06-01'),
    last_seen_at: new Date('2026-06-10'),
    location_lat: 39.9,
    location_lng: 116.4,
    address: 'Beijing',
    notes: null,
    tags: null,
    photos: null,
    primary_nose_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    age_estimate: null,
    health_status: null,
    sterilized: false,
    size: null,
    coat_length: null,
    ear_type: null,
    tail_type: null,
    ...overrides,
  } as Animal;
}

describe('AnimalsService', () => {
  let service: AnimalsService;
  let animalRepo: ReturnType<typeof makeRepo>;
  let noseRepo: ReturnType<typeof makeRepo>;
  let eventRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    animalRepo = makeRepo();
    noseRepo = makeRepo();
    eventRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalsService,
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: getRepositoryToken(NoseFeature), useValue: noseRepo },
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
      ],
    }).compile();

    service = module.get<AnimalsService>(AnimalsService);
  });

  // ========== findAll ==========
  describe('findAll', () => {
    it('无过滤条件应返回所有非 archived 动物', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[makeAnimal()], 1]);
      const result = await service.findAll({});
      expect(result.total).toBe(1);
      expect(animalRepo.createQueryBuilder).toHaveBeenCalled();
      // 默认应排除 archived
      expect(animalRepo._qb.andWhere).toHaveBeenCalledWith(
        'a.status != :archived',
        { archived: 'archived' },
      );
    });

    it('按 species 过滤', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ species: 'cat' });
      expect(animalRepo._qb.andWhere).toHaveBeenCalledWith(
        'a.species = :species',
        { species: 'cat' },
      );
    });

    it('按 status=archived 过滤时不应再排除 archived', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ status: 'archived' });
      // 因 status==='archived',应跳过 "a.status != :archived" 过滤
      const calls = animalRepo._qb.andWhere.mock.calls;
      const hasArchivedExclusion = calls.some(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('a.status != :archived'),
      );
      expect(hasArchivedExclusion).toBe(false);
    });

    it('include_archived=true 应保留 archived', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ include_archived: true });
      const calls = animalRepo._qb.andWhere.mock.calls;
      const hasArchivedExclusion = calls.some(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('a.status != :archived'),
      );
      expect(hasArchivedExclusion).toBe(false);
    });

    it('include_archived="false"(字符串) 应排除 archived', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ include_archived: 'false' });
      expect(animalRepo._qb.andWhere).toHaveBeenCalledWith(
        'a.status != :archived',
        { archived: 'archived' },
      );
    });

    it('按 keyword 模糊搜索 breed/color/address', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ keyword: 'yellow' });
      expect(animalRepo._qb.andWhere).toHaveBeenCalledWith(
        '(a.breed LIKE :kw OR a.color LIKE :kw OR a.address LIKE :kw)',
        { kw: '%yellow%' },
      );
    });

    it('page=2,limit=5 应正确 skip/take', async () => {
      animalRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 2, limit: 5 });
      expect(animalRepo._qb.skip).toHaveBeenCalledWith(5);
      expect(animalRepo._qb.take).toHaveBeenCalledWith(5);
    });

    // ========== Bug5 修复: report_count 字段 ==========
    it('【Bug5】findAll 应通过 eventRepo 单独查每个动物的 report_count 并合并', async () => {
      // 模拟 2 只 animal 列表
      const a1 = makeAnimal({ animal_id: 'a-1' });
      const a2 = makeAnimal({ animal_id: 'a-2' });
      animalRepo._qb.getManyAndCount.mockResolvedValue([[a1, a2], 2]);
      // eventRepo 单独查 counts
      const countQb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { animal_id: 'a-1', cnt: 2 },
        ]),
      };
      eventRepo.createQueryBuilder.mockReturnValue(countQb);

      const result = await service.findAll({});
      // a-1 命中 2,a-2 查不到 counts → 0
      expect(result.list).toHaveLength(2);
      expect(result.list[0].report_count).toBe(2);
      expect(result.list[1].report_count).toBe(0);
      // 验证有调用 createQueryBuilder 查 counts
      expect(eventRepo.createQueryBuilder).toHaveBeenCalled();
      expect(countQb.groupBy).toHaveBeenCalledWith('e.animal_id');
    });
  });

  // ========== findOne ==========
  describe('findOne', () => {
    it('动物不存在应抛 NotFoundException', async () => {
      animalRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('动物存在应返回(含 report_count)', async () => {
      const a = makeAnimal();
      animalRepo.findOne.mockResolvedValue(a);
      // 默认 eventRepo._qb.getCount 返回 0
      const result = await service.findOne('animal-1');
      expect(result).toEqual({ ...a, report_count: 0 });
    });
  });

  // ========== create ==========
  describe('create', () => {
    it('建档应自动生成 animal_id 并设置 status=LOST', async () => {
      animalRepo.save.mockImplementation(async (e) => ({ ...e, animal_id: e.animal_id || 'generated-id' }));

      const dto = {
        species: 'dog',
        breed: 'shiba',
        color: 'yellow',
        gender: 'male',
        location_lat: 39.9,
        location_lng: 116.4,
      };

      const result = await service.create(dto as any);

      expect(result.animal_id).toBeDefined();
      expect(result.status).toBe(AnimalStatus.LOST);
      expect(animalRepo.save).toHaveBeenCalled();
    });

    it('建档时无 GPS 应默认 0', async () => {
      animalRepo.save.mockImplementation(async (e) => e);
      await service.create({ species: 'dog' } as any);
      const saved = animalRepo.save.mock.calls[0][0];
      expect(saved.location_lat).toBe(0);
      expect(saved.location_lng).toBe(0);
    });

    it('建档时 first_seen_at 应默认 now,last_seen_at 缺省时同 first_seen_at', async () => {
      animalRepo.save.mockImplementation(async (e) => e);
      const before = new Date();
      await service.create({ species: 'dog' } as any);
      const after = new Date();
      const saved = animalRepo.save.mock.calls[0][0];
      expect(saved.first_seen_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(saved.last_seen_at.getTime()).toBe(saved.first_seen_at.getTime());
      expect(saved.last_seen_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('【Bug6 兜底】建档时回填孤儿 NoseFeature.animal_id', async () => {
      animalRepo.save.mockImplementation(async (e) => ({ ...e, animal_id: 'new-animal-id' }));
      noseRepo.update.mockResolvedValue({ affected: 2 });

      await service.create({
        species: 'dog',
        primary_nose_id: 'orphan-vector-id',
      } as any);

      expect(noseRepo.update).toHaveBeenCalledWith(
        { vector_id: 'orphan-vector-id', animal_id: IsNull() },
        { animal_id: 'new-animal-id' },
      );
    });

    it('无 primary_nose_id 时不应调用 noseRepo.update', async () => {
      animalRepo.save.mockImplementation(async (e) => e);
      await service.create({ species: 'dog' } as any);
      expect(noseRepo.update).not.toHaveBeenCalled();
    });
  });

  // ========== update ==========
  describe('update', () => {
    it('动物不存在应抛 NotFoundException', async () => {
      animalRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('应更新所有非空字段', async () => {
      const original = makeAnimal({
        breed: 'shiba',
        status: AnimalStatus.LOST,
        address: 'Beijing',
      });
      animalRepo.findOne.mockResolvedValue(original);
      animalRepo.save.mockImplementation(async (e) => e);

      const result = await service.update('animal-1', {
        breed: 'poodle',
        status: 'found' as any,
        address: 'Shanghai',
      } as any);

      expect(result.breed).toBe('poodle');
      expect(result.status).toBe(AnimalStatus.FOUND);
      expect(result.address).toBe('Shanghai');
      // 未改字段保留
      expect(result.color).toBe('yellow');
    });

    it('【Bug】status 字段应能被正确更新(之前是 no-op)', async () => {
      const original = makeAnimal({ status: AnimalStatus.LOST });
      animalRepo.findOne.mockResolvedValue(original);
      animalRepo.save.mockImplementation(async (e) => e);

      const result = await service.update('animal-1', { status: 'archived' as any });
      expect(result.status).toBe(AnimalStatus.ARCHIVED);
    });

    it('空 dto 应保留原值', async () => {
      const original = makeAnimal();
      animalRepo.findOne.mockResolvedValue(original);
      animalRepo.save.mockImplementation(async (e) => e);

      const result = await service.update('animal-1', {});
      expect(result.breed).toBe(original.breed);
      expect(result.status).toBe(original.status);
    });

    it('location_lat/lng 应转 Number', async () => {
      const original = makeAnimal({ location_lat: 39.9, location_lng: 116.4 });
      animalRepo.findOne.mockResolvedValue(original);
      animalRepo.save.mockImplementation(async (e) => e);

      const result = await service.update('animal-1', {
        location_lat: '40.0' as any,
        location_lng: '116.5' as any,
      });
      expect(result.location_lat).toBe(40.0);
      expect(result.location_lng).toBe(116.5);
    });
  });

  // ========== remove ==========
  describe('remove', () => {
    it('动物不存在应抛 NotFoundException', async () => {
      animalRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('应删除并按 animal_id 过滤', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal());
      animalRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove('animal-1');

      expect(animalRepo.delete).toHaveBeenCalledWith({ animal_id: 'animal-1' });
    });
  });
});