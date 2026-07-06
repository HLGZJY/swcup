import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RescueEvent, EventType, EventStatus } from '../events/entities/event.entity';
import { Claim, ClaimStatus } from '../claims/entities/claim.entity';
import { Animal, AnimalStatus, Species } from '../animals/entities/animal.entity';
import { User, UserRole } from '../users/entities/user.entity';

function makeRepo() {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getCount: jest.fn(),
  };
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
  };
}

function makeDataSource() {
  return {
    transaction: jest.fn(async (cb) => {
      // manager mock
      const manager = {
        findOne: jest.fn(),
        save: jest.fn(async (e) => e),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      return cb(manager);
    }),
  };
}

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    animal_id: 'animal-1',
    status: AnimalStatus.LOST,
    species: Species.DOG,
    breed: 'shiba',
    color: 'yellow',
    gender: 'male' as any,
    first_seen_at: new Date('2026-06-01'),
    last_seen_at: new Date('2026-06-10'),
    location_lat: 39.9,
    location_lng: 116.4,
    address: 'Beijing',
    notes: null,
    tags: null,
    photos: ['/p/1.jpg'],
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

function makeEvent(overrides: Partial<RescueEvent> = {}): RescueEvent {
  return {
    event_id: 'event-1',
    reporter_id: 'user-1',
    event_type: EventType.REPORT,
    occurred_at: new Date('2026-06-10'),
    location_lat: 39.901,
    location_lng: 116.401,
    address: 'Beijing',
    description: 'Found a dog',
    photos: ['/p/e1.jpg'],
    nose_photo_url: null,
    nose_vector_id: null,
    is_duplicate: false,
    duplicate_of: null,
    fusion_score: 0.81,
    vector_similarity: null,
    gps_similarity: 0.9,
    image_similarity: null,
    text_match_rate: 0.66,
    time_score: 1.0,
    status: EventStatus.PENDING,
    candidates: [
      {
        animal_id: 'animal-1',
        breed: 'shiba',
        color: 'yellow',
        gender: 'male',
        status: 'lost',
        photos: ['/p/1.jpg'],
        address: 'Beijing',
        fusion_score: 0.81,
        scores: {
          gps_similarity: 0.9,
          text_match_rate: 0.66,
          time_score: 1.0,
          vector_similarity: null,
          image_similarity: null,
        },
        is_recommended: true,
      },
    ],
    species: 'dog',
    breed: 'shiba',
    color: 'yellow',
    gender: 'male' as any,
    animal_id: null,
    station_id: null,
    action_taken: null,
    created_at: new Date(),
    ...overrides,
  } as RescueEvent;
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    claim_id: 'claim-1',
    animal_id: 'animal-1',
    claimer_id: 'user-1',
    event_id: null,
    claimed_at: new Date(),
    status: ClaimStatus.PENDING,
    notes: null,
    proof_photos: null,
    approved_by: null,
    approved_at: null,
    created_at: new Date(),
    ...overrides,
  } as Claim;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'user-1',
    nickname: 'Tester',
    phone: '13800001234',
    openid: null,
    password_hash: 'h',
    agreed_privacy_at: new Date(),
    role: UserRole.USER,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  } as User;
}

describe('AdminService', () => {
  let service: AdminService;
  let eventRepo: ReturnType<typeof makeRepo>;
  let claimRepo: ReturnType<typeof makeRepo>;
  let animalRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let dataSource: ReturnType<typeof makeDataSource>;

  beforeEach(async () => {
    eventRepo = makeRepo();
    claimRepo = makeRepo();
    animalRepo = makeRepo();
    userRepo = makeRepo();
    dataSource = makeDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: getRepositoryToken(Claim), useValue: claimRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ========== stats ==========
  describe('stats', () => {
    it('应返回所有统计数据', async () => {
      animalRepo.count
        .mockResolvedValueOnce(100)   // total
        .mockResolvedValueOnce(30)    // lost
        .mockResolvedValueOnce(50)    // found
        .mockResolvedValueOnce(20);   // claimed
      eventRepo.count.mockResolvedValueOnce(5);   // pendingEvents
      claimRepo.count.mockResolvedValueOnce(3);   // pendingClaims
      eventRepo._qb.getCount.mockResolvedValueOnce(10); // todayReports
      eventRepo._qb.getCount.mockResolvedValueOnce(7);  // todayResolved

      const result = await service.stats();

      expect(result.totalAnimals).toBe(100);
      expect(result.lostAnimals).toBe(30);
      expect(result.foundAnimals).toBe(50);
      expect(result.claimedAnimals).toBe(20);
      expect(result.pendingEvents).toBe(5);
      expect(result.pendingClaims).toBe(3);
      expect(result.todayReports).toBe(10);
      expect(result.todayResolved).toBe(7);
      expect(result.todayProcessing).toBe(3);
    });
  });

  // ========== getEvents ==========
  describe('getEvents', () => {
    it('应支持 status 过滤和分页', async () => {
      eventRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.getEvents({ status: 'pending', page: 2, limit: 10 });
      expect(eventRepo._qb.andWhere).toHaveBeenCalledWith('e.status = :status', { status: 'pending' });
      expect(eventRepo._qb.skip).toHaveBeenCalledWith(10);
      expect(eventRepo._qb.take).toHaveBeenCalledWith(10);
    });
  });

  // ========== getEventDetail ==========
  describe('getEventDetail', () => {
    it('事件不存在应抛 Error', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.getEventDetail('missing')).rejects.toThrow('Event not found');
    });

    it('无 candidates 应返回基础字段', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ candidates: null }));
      const result = await service.getEventDetail('event-1');
      expect(result.event_id).toBe('event-1');
      expect(result.candidates).toEqual([]);
    });

    it('有 candidates 应 join animal 表补全字段', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent());
      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      const result = await service.getEventDetail('event-1');
      expect(result.candidates.length).toBe(1);
      // animal 表的 photos 应优先于 candidates.photos
      expect(result.candidates[0].photos).toEqual(['/p/1.jpg']);
    });

    it('image_similarity 永远为 null(Bug 2026-06-13 决定)', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent());
      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      const result = await service.getEventDetail('event-1');
      expect(result.candidates[0].scores.image_similarity).toBeNull();
      expect(result.image_similarity).toBeNull();
    });
  });

  // ========== confirmEvent ==========
  describe('confirmEvent', () => {
    it('【TC-E2E-004】report 事件无 animal_id → 自动建档', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(makeEvent({ event_type: 'report' as any, animal_id: null })),
        save: jest.fn(async (e) => ({ ...e, animal_id: 'new-auto-id' })),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.confirmEvent('event-1');

      // 应新建 Animal 档案
      expect(manager.save).toHaveBeenCalled();
      const savedAnimal = manager.save.mock.calls[0][0];
      expect(savedAnimal.status).toBe('found');
      expect(savedAnimal.species).toBe('dog');
      expect(savedAnimal.breed).toBe('shiba');

      // 应回填 event.animal_id
      expect(manager.update).toHaveBeenCalledWith(
        RescueEvent,
        { event_id: 'event-1' },
        expect.objectContaining({
          status: 'confirmed',
          animal_id: 'new-auto-id',
        }),
      );
    });

    it('report 事件无 species/breed 应使用兜底', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(makeEvent({
          event_type: 'report' as any,
          animal_id: null,
          species: null,
          breed: null,
          color: null,
          gender: null,
        })),
        save: jest.fn(async (e) => e),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.confirmEvent('event-1');

      const savedAnimal = manager.save.mock.calls[0][0];
      expect(savedAnimal.species).toBe('other');
      expect(savedAnimal.gender).toBe('unknown');
    });

    it('report 事件有 animal_id → 仅更新 event', async () => {
      const manager = {
        findOne: jest.fn()
          .mockResolvedValueOnce(makeEvent({
            event_type: 'report' as any,
            animal_id: 'existing-animal-id',
          }))
          .mockResolvedValueOnce(makeAnimal({ animal_id: 'existing-animal-id' })),
        save: jest.fn(),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.confirmEvent('event-1', 'existing-animal-id');

      // 不应新建 Animal
      expect(manager.save).not.toHaveBeenCalled();
      // 应更新 event.animal_id + status
      expect(manager.update).toHaveBeenCalledWith(
        RescueEvent,
        { event_id: 'event-1' },
        expect.objectContaining({
          animal_id: 'existing-animal-id',
          status: 'duplicated',
          is_duplicate: true,
        }),
      );
    });

    it('非 report 事件 + 传 animal_id → 仅更新 event', async () => {
      const manager = {
        findOne: jest.fn().mockImplementation(async () => {
          // 第一次: 查 event
          // 第二次: 查 animal
          if (manager.findOne.mock.calls.length === 1) {
            return makeEvent({ event_type: 'collect' as any });
          }
          return makeAnimal();
        }),
        save: jest.fn(),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.confirmEvent('event-1', 'target-animal-id');

      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(
        RescueEvent,
        { event_id: 'event-1' },
        expect.objectContaining({
          animal_id: 'target-animal-id',
          status: 'duplicated',
          is_duplicate: true,
        }),
      );
    });

    it('animal_id 传错(动物不存在)应抛 Error', async () => {
      let callCount = 0;
      const manager = {
        findOne: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) return makeEvent({ event_type: 'collect' as any });
          return null;  // animal 不存在
        }),
        save: jest.fn(),
        update: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.confirmEvent('event-1', 'missing-animal')).rejects.toThrow('Animal not found');
    });

    it('事件不存在应抛 Error', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        save: jest.fn(),
        update: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.confirmEvent('missing')).rejects.toThrow('Event not found');
    });
  });

  // ========== rejectEvent ==========
  describe('rejectEvent', () => {
    it('应设置 status=rejected', async () => {
      await service.rejectEvent('event-1');
      expect(eventRepo.update).toHaveBeenCalledWith({ event_id: 'event-1' }, { status: 'rejected' });
    });
  });

  // ========== getClaims ==========
  describe('getClaims', () => {
    it('应 join claimer + animal + 脱敏手机号', async () => {
      claimRepo._qb.getManyAndCount.mockResolvedValue([[{
        claim_id: 'c-1',
        animal_id: 'a-1',
        event_id: null,
        claimer_id: 'u-1',
        notes: null,
        status: 'pending',
        created_at: new Date(),
        claimer: { user_id: 'u-1', nickname: 'X', phone: '13800001234' },
        animal: { animal_id: 'a-1', species: 'dog', breed: 'shiba', color: 'yellow' },
      }], 1]);

      const result = await service.getClaims({});
      expect(result.list[0].user.phone).toBe('138****1234');
      expect(result.list[0].animal.breed).toBe('shiba');
    });
  });

  // ========== approveClaim ==========
  describe('approveClaim', () => {
    it('claim 不存在应抛 NotFoundException', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.approveClaim('missing', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('【状态机】非 pending claim 应抛 BadRequestException', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(makeClaim({ status: 'approved' as any })),
        update: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.approveClaim('claim-1', 'admin-1'))
        .rejects.toThrow(/不可重复审批/);
    });

    it('pending claim 应批准 + 动物状态 → claimed (级联)', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(makeClaim({ status: 'pending' as any })),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.approveClaim('claim-1', 'admin-1');

      // claim 更新
      expect(manager.update).toHaveBeenCalledWith(
        Claim,
        { claim_id: 'claim-1' },
        expect.objectContaining({
          status: 'approved',
          approved_by: 'admin-1',
          approved_at: expect.any(Date),
        }),
      );
      // 动物状态机级联
      expect(manager.update).toHaveBeenCalledWith(
        Animal,
        { animal_id: 'animal-1' },
        { status: 'claimed' },
      );
      expect(result.status).toBe('approved');
    });
  });

  // ========== rejectClaim ==========
  describe('rejectClaim', () => {
    it('应设置 status=rejected', async () => {
      await service.rejectClaim('claim-1');
      expect(claimRepo.update).toHaveBeenCalledWith({ claim_id: 'claim-1' }, { status: 'rejected' });
    });
  });

  // ========== getUsers ==========
  describe('getUsers', () => {
    it('应支持 role 过滤', async () => {
      userRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.getUsers({ role: 'admin' });
      expect(userRepo._qb.andWhere).toHaveBeenCalledWith('u.role = :role', { role: 'admin' });
    });

    it('应支持 keyword 模糊搜索 nickname/phone', async () => {
      userRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.getUsers({ keyword: 'tester' });
      expect(userRepo._qb.andWhere).toHaveBeenCalledWith(
        '(u.nickname LIKE :kw OR u.phone LIKE :kw)',
        { kw: '%tester%' },
      );
    });
  });

  // ========== getUserDetail ==========
  describe('getUserDetail', () => {
    it('用户不存在应抛 Error', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserDetail('missing')).rejects.toThrow('User not found');
    });

    it('应脱敏手机号', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ phone: '13800001234' }));
      const result = await service.getUserDetail('user-1');
      expect(result.phone).toBe('138****1234');
    });
  });

  // ========== getUserEvents / getUserClaims / getUserAnimals ==========
  describe('getUserEvents', () => {
    it('应按 reporter_id 过滤', async () => {
      eventRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.getUserEvents('user-1', {});
      const calls = eventRepo._qb.where.mock.calls;
      expect(calls.some((c: any[]) => String(c[0]).includes('reporter_id = :user_id'))).toBe(true);
    });
  });

  describe('getUserAnimals', () => {
    it('用户无任何事件应返回空', async () => {
      eventRepo.find.mockResolvedValue([]);
      const result = await service.getUserAnimals('user-1', {});
      expect(result).toEqual({ total: 0, list: [] });
    });

    it('应通过事件 animal_id 反查动物', async () => {
      eventRepo.find.mockResolvedValue([
        { animal_id: 'animal-1' },
        { animal_id: 'animal-2' },
        { animal_id: null },
        { animal_id: 'animal-1' },  // 重复
      ]);
      animalRepo._qb.getManyAndCount.mockResolvedValue([[
        makeAnimal({ animal_id: 'animal-1', breed: 'shiba' }),
        makeAnimal({ animal_id: 'animal-2', breed: 'poodle' }),
      ], 2]);

      const result = await service.getUserAnimals('user-1', { page: 1, limit: 10 });
      // 去重后应有 2 个 animal
      expect(result.total).toBe(2);
      expect(result.list.length).toBe(2);
    });
  });

  // ========== updateUser ==========
  describe('updateUser', () => {
    it('应更新并返回脱敏用户', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ phone: '13800001234' }));
      const result = await service.updateUser('user-1', { nickname: 'NewName' });
      expect(userRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-1' },
        { nickname: 'NewName' },
      );
      expect(result.phone).toBe('138****1234');
    });
  });
});