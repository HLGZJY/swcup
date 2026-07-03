import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { EventsService } from './events.service';
import { NoseService } from '../nose/nose.service';
import { MatchingService } from '../matching/matching.service';
import { RescueEvent, EventType, EventStatus } from './entities/event.entity';
import { Animal, AnimalStatus, Species } from '../animals/entities/animal.entity';

function makeEventRepo() {
  return {
    create: jest.fn((dto) => dto),
    save: jest.fn(async (e) => e),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(),
  };
}

function makeAnimalRepo() {
  return {
    findOne: jest.fn(),
  };
}

function makeNoseService() {
  return {
    compare: jest.fn(),
  };
}

function makeMatchingService() {
  return {
    findSimilarLostAnimalsForReport: jest.fn(),
  };
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
    description: null,
    photos: [],
    nose_photo_url: null,
    nose_vector_id: null,
    is_duplicate: false,
    duplicate_of: null,
    fusion_score: null,
    vector_similarity: null,
    gps_similarity: null,
    image_similarity: null,
    text_match_rate: null,
    time_score: null,
    status: EventStatus.PENDING,
    candidates: null,
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

describe('EventsService', () => {
  let service: EventsService;
  let eventRepo: ReturnType<typeof makeEventRepo>;
  let animalRepo: ReturnType<typeof makeAnimalRepo>;
  let noseService: ReturnType<typeof makeNoseService>;
  let matchingService: ReturnType<typeof makeMatchingService>;

  beforeEach(async () => {
    eventRepo = makeEventRepo();
    animalRepo = makeAnimalRepo();
    noseService = makeNoseService();
    matchingService = makeMatchingService();

    // 静默 logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: NoseService, useValue: noseService },
        { provide: MatchingService, useValue: matchingService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  // ========== create ==========
  describe('create', () => {
    it('应使用请求坐标', async () => {
      const dto = {
        event_type: 'report',
        species: 'dog',
        location_lat: 39.9,
        location_lng: 116.4,
        address: 'Beijing',
      };
      const result = await service.create(dto as any, 'user-1');
      expect(result.event_id).toBeDefined();
      expect(result.status).toBe('pending');
      const saved = eventRepo.save.mock.calls[0][0];
      expect(saved.location_lat).toBe(39.9);
      expect(saved.location_lng).toBe(116.4);
      expect(saved.reporter_id).toBe('user-1');
    });

    it('【兜底】无 GPS 时应从 animal_id 反查', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ location_lat: 39.95, location_lng: 116.45 }));
      await service.create({
        event_type: 'report',
        species: 'dog',
        animal_id: 'animal-1',
      } as any, 'user-1');
      const saved = eventRepo.save.mock.calls[0][0];
      expect(saved.location_lat).toBe(39.95);
      expect(saved.location_lng).toBe(116.45);
    });

    it('【兜底】无 GPS + animal 也无坐标 → 用天安门兜底坐标', async () => {
      animalRepo.findOne.mockResolvedValue(null);
      await service.create({
        event_type: 'report',
        species: 'dog',
      } as any, 'user-1');
      const saved = eventRepo.save.mock.calls[0][0];
      // 兜底: 39.9087, 116.3975
      expect(saved.location_lat).toBeCloseTo(39.9087, 3);
      expect(saved.location_lng).toBeCloseTo(116.3975, 3);
    });

    it('【兜底】animal 有 GPS=0 时仍应回退到兜底坐标', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ location_lat: 0, location_lng: 0 }));
      await service.create({
        event_type: 'report',
        species: 'dog',
        animal_id: 'animal-1',
      } as any, 'user-1');
      const saved = eventRepo.save.mock.calls[0][0];
      expect(saved.location_lat).toBeCloseTo(39.9087, 3);
    });
  });

  // ========== findByReporter ==========
  describe('findByReporter', () => {
    it('应按 reporter_id 过滤,created_at DESC', async () => {
      eventRepo.find.mockResolvedValue([]);
      await service.findByReporter('user-1');
      expect(eventRepo.find).toHaveBeenCalledWith({
        where: { reporter_id: 'user-1' },
        order: { created_at: 'DESC' },
      });
    });
  });

  // ========== findAll ==========
  describe('findAll', () => {
    it('应支持 status 过滤和分页', async () => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      eventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ status: 'pending', page: 2, limit: 5 });

      expect(qb.andWhere).toHaveBeenCalledWith('e.status = :status', { status: 'pending' });
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });
  });

  // ========== confirm / reject ==========
  describe('confirm', () => {
    it('应设置 status=duplicated + is_duplicate=true', async () => {
      await service.confirm('event-1');
      expect(eventRepo.update).toHaveBeenCalledWith(
        { event_id: 'event-1' },
        { status: EventStatus.DUPLICATED, is_duplicate: true },
      );
    });
  });

  describe('reject', () => {
    it('应设置 status=rejected', async () => {
      await service.reject('event-1');
      expect(eventRepo.update).toHaveBeenCalledWith(
        { event_id: 'event-1' },
        { status: EventStatus.REJECTED },
      );
    });
  });

  // ========== processEvent ==========
  describe('processEvent', () => {
    it('事件不存在应抛错', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.processEvent('missing')).rejects.toThrow('Event not found');
    });

    it('【collect 流程】有 nose_vector_id → 走鼻纹 AI 匹配', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1' }));
      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-1',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 0.92,
            vector_similarity: 0.95,
            gps_similarity: 0.8,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      const result = await service.processEvent('event-1');

      expect(noseService.compare).toHaveBeenCalled();
      expect(matchingService.findSimilarLostAnimalsForReport).not.toHaveBeenCalled();
      expect(result.matching_mode).toBe('nose');
      expect(result.candidates_count).toBe(1);
      expect(result.fusion_score).toBe(0.92);
      expect(eventRepo.update).toHaveBeenCalled();
      const updateArg = eventRepo.update.mock.calls[0][1];
      expect(updateArg.status).toBe(EventStatus.PENDING);
      expect(updateArg.fusion_score).toBe(0.92);
      // 候选对象的 vector_similarity 应被存入 candidates 数组
      expect(updateArg.candidates.length).toBe(1);
      expect(updateArg.candidates[0].scores.vector_similarity).toBe(0.95);
      expect(updateArg.candidates[0].scores.gps_similarity).toBe(0.8);
      expect(updateArg.candidates[0].scores.text_match_rate).toBe(1.0);
    });

    it('【report 流程】无 nose_vector_id → 走图片+GPS+文本+时间匹配', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: null }));
      matchingService.findSimilarLostAnimalsForReport.mockResolvedValue([
        {
          animal_id: 'animal-1',
          breed: 'shiba',
          color: 'yellow',
          gender: 'male',
          status: 'lost',
          photos: ['/p/1.jpg'],
          address: 'Beijing',
          fusion_score: 0.81,
          scores: { image_similarity: null, gps_similarity: 0.9, text_match_rate: 0.66, time_score: 1.0 },
          distance_m: 120,
          is_recommended: true,
        },
      ]);

      const result = await service.processEvent('event-1');

      expect(matchingService.findSimilarLostAnimalsForReport).toHaveBeenCalled();
      expect(noseService.compare).not.toHaveBeenCalled();
      expect(result.matching_mode).toBe('report');
      expect(result.candidates_count).toBe(1);
      expect(result.fusion_score).toBe(0.81);
      const updateArg = eventRepo.update.mock.calls[0][1];
      expect(updateArg.vector_similarity).toBeNull();  // report 永远 null
      expect(updateArg.image_similarity).toBeNull();   // 永远 null
      expect(updateArg.time_score).toBe(1.0);
    });

    it('【collect】鼻纹比对无结果时 fusion_score 应为 null', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1' }));
      noseService.compare.mockResolvedValue({ results: [] });

      const result = await service.processEvent('event-1');
      expect(result.fusion_score).toBeNull();
      expect(result.candidates_count).toBe(0);
    });

    it('【report】无候选动物时 fusion_score 应为 null', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: null }));
      matchingService.findSimilarLostAnimalsForReport.mockResolvedValue([]);

      const result = await service.processEvent('event-1');
      expect(result.fusion_score).toBeNull();
    });

    it('错误应被重新抛出(以便 controller 抛 500)', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1' }));
      noseService.compare.mockRejectedValue(new Error('AI service down'));

      await expect(service.processEvent('event-1')).rejects.toThrow('AI service down');
    });

    // ========== Bug6 修复: 候选池方案 ==========
    it('【Bug6 候选池】fusion_score >= 0.8 时应自动设置 is_duplicate/duplicate_of/animal_id', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1', animal_id: null }));
      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-target',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 0.85,
            vector_similarity: 0.9,
            gps_similarity: 0.8,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];
      // 候选池标记
      expect(updateArg.is_duplicate).toBe(true);
      expect(updateArg.duplicate_of).toBe('animal-target');
      expect(updateArg.animal_id).toBe('animal-target');
      // status 保持 PENDING(等 admin 二次确认)
      expect(updateArg.status).toBe(EventStatus.PENDING);
    });

    it('【Bug6 候选池】fusion_score < 0.8 时不应自动入候选池', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1', animal_id: null }));
      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-similar',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 0.55,  // 低于 0.8 阈值
            vector_similarity: 0.6,
            gps_similarity: 0.5,
            text_match_rate: 0.5,
            is_recommended: false,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];
      // 不应自动入候选池
      expect(updateArg.is_duplicate).not.toBe(true);
      // duplicate_of 字段不进 update payload(数据库字段默认 null)
      expect(updateArg.duplicate_of).toBeFalsy();
      expect(updateArg.status).toBe(EventStatus.PENDING);
    });

    it('【Bug6 候选池】report 流程 fusion_score >= 0.8 也应入候选池', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: null, animal_id: null }));
      matchingService.findSimilarLostAnimalsForReport.mockResolvedValue([
        {
          animal_id: 'animal-report-target',
          breed: 'shiba',
          color: 'yellow',
          gender: 'male',
          status: 'lost',
          photos: ['/p/1.jpg'],
          address: 'Beijing',
          fusion_score: 0.82,
          scores: { image_similarity: null, gps_similarity: 0.9, text_match_rate: 0.66, time_score: 1.0 },
          distance_m: 120,
          is_recommended: true,
        },
      ]);

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];
      expect(updateArg.is_duplicate).toBe(true);
      expect(updateArg.duplicate_of).toBe('animal-report-target');
      expect(updateArg.animal_id).toBe('animal-report-target');
    });

    it('【Bug6 候选池】top candidate 没有 animal_id 时不设 duplicate_of', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1' }));
      noseService.compare.mockResolvedValue({
        results: [
          {
            // 孤儿鼻纹匹配,没有 animal_id
            animal_id: null,
            animal: null,
            fusion_score: 0.9,
            vector_similarity: 0.9,
            gps_similarity: null,
            text_match_rate: 1.0,
            is_recommended: false,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];
      // 没有 animal_id,不能入候选池
      expect(updateArg.is_duplicate).not.toBe(true);
      expect(updateArg.duplicate_of).toBeFalsy();
    });
  });
});