import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { EventsService } from './events.service';
import { NoseService } from '../nose/nose.service';
import { MatchingService } from '../matching/matching.service';
import { AnimalsService } from '../animals/animals.service';
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

function makeAnimalsService() {
  return {
    create: jest.fn(),
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
  let animalsService: ReturnType<typeof makeAnimalsService>;

  beforeEach(async () => {
    eventRepo = makeEventRepo();
    animalRepo = makeAnimalRepo();
    noseService = makeNoseService();
    matchingService = makeMatchingService();
    animalsService = makeAnimalsService();

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
        { provide: AnimalsService, useValue: animalsService },
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

    // ========== 阶段 1 (2026-07-06): intent 决定自动建档 ==========
    it('【阶段 1】intent="lost" + 无 animal_id → 应自动调 AnimalsService.create 并关联动物 ID', async () => {
      // 场景 A/B: 用户上报走失狗狗,未指定 animal_id
      // 期望: eventsService 自动通过 animalsService.create 建一个 status=lost 的 Animal 档,
      //       然后把生成的 animal_id 回写到事件的 animal_id 字段
      animalsService.create.mockResolvedValue({ animal_id: 'auto-animal-id-1' });

      const dto = {
        event_type: 'report',
        intent: 'lost',
        species: 'dog',
        breed: 'shiba',
        color: 'yellow',
        gender: 'male',
        location_lat: 39.9,
        location_lng: 116.4,
        address: 'Beijing',
      };

      await service.create(dto as any, 'user-1');

      // 1. 必须调过 animalsService.create,且把 intent 透传过去(决定 Animal.status)
      expect(animalsService.create).toHaveBeenCalledTimes(1);
      const animalDto = animalsService.create.mock.calls[0][0];
      expect(animalDto.intent).toBe('lost');
      expect(animalDto.species).toBe('dog');
      expect(animalDto.breed).toBe('shiba');

      // 2. 事件的 animal_id 必须被回填为新建动物的 ID
      const savedEvent = eventRepo.save.mock.calls[0][0];
      expect(savedEvent.animal_id).toBe('auto-animal-id-1');
    });

    it('【阶段 1】intent="stray_sighting" + 无 animal_id → 不应自动建档,事件 animal_id 保持 undefined', async () => {
      // 场景 C/D: 用户上报目击流浪狗
      // 期望: stray_sighting 是 sighting event,可能多只动物,不应自动建专属 Animal 档
      animalsService.create.mockResolvedValue({ animal_id: 'should-not-create' });

      const dto = {
        event_type: 'report',
        intent: 'stray_sighting',
        species: 'dog',
        location_lat: 39.9,
        location_lng: 116.4,
      };

      await service.create(dto as any, 'user-1');

      // stray_sighting 不应触发自动建档
      expect(animalsService.create).not.toHaveBeenCalled();

      // 事件 animal_id 应保持 undefined/null(让 admin 在事件合并时手动挑)
      const savedEvent = eventRepo.save.mock.calls[0][0];
      expect(savedEvent.animal_id).toBeFalsy();
    });

    it('【阶段 1】已有 animal_id → 不应自动建档(沿用现有 Animal)', async () => {
      // 场景: 用户/认领页传了已有动物 ID
      // 期望: 不应触发自动建档,事件 animal_id 用传来的 ID
      animalsService.create.mockResolvedValue({ animal_id: 'should-not-create' });

      const dto = {
        event_type: 'report',
        intent: 'lost',
        species: 'dog',
        location_lat: 39.9,
        location_lng: 116.4,
        animal_id: 'existing-animal-1',
      };

      await service.create(dto as any, 'user-1');

      expect(animalsService.create).not.toHaveBeenCalled();

      const savedEvent = eventRepo.save.mock.calls[0][0];
      expect(savedEvent.animal_id).toBe('existing-animal-1');
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

    // ========== BUG-005/007 回归: 排除 self-merge ==========
    it('【回归 BUG-005】event.animal_id == top1.animal_id (self-merge, fusion=1.0) 应被剔除', async () => {
      // 场景: collect 事件刚 INSERT 新动物 A → processEvent 比对时 candidates[0]=A (向量相同 fusion=1.0)
      // 旧逻辑: 直接把 duplicate_of=A (自身) 入候选池 → admin 看到 self-merge 合并候选
      // 新逻辑: 剔除自身后若还有候选,用 next best;若无候选,topCandidate=null,不设 is_duplicate
      eventRepo.findOne.mockResolvedValue(
        makeEvent({ nose_vector_id: 'v-1', animal_id: 'animal-self' }),
      );
      noseService.compare.mockResolvedValue({
        results: [
          // 候选池里第一个就是刚刚 INSERT 的自己,fusion=1.0
          {
            animal_id: 'animal-self',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 1.0,
            vector_similarity: 1.0,
            gps_similarity: 1.0,
            text_match_rate: 1.0,
            is_recommended: true,
          },
          // 第二个是另一个真正可疑的动物
          {
            animal_id: 'animal-other',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 0.85,
            vector_similarity: 0.88,
            gps_similarity: 0.8,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];

      // 关键断言: duplicate_of 不能指向自身,应该指向 next best
      expect(updateArg.duplicate_of).toBe('animal-other');
      expect(updateArg.duplicate_of).not.toBe('animal-self');
      expect(updateArg.animal_id).toBe('animal-other');
      // fusion_score 也应反映 next-best 的 0.85,而不是 self 的 1.0
      expect(updateArg.fusion_score).toBe(0.85);
    });

    it('【回归 BUG-007】事件 animal_id 非空但所有候选都是自身 → 不应入候选池', async () => {
      // 极端场景: 数据库里只有自己这一只动物,候选池全是自身
      // 旧逻辑: 直接 duplicate_of=自身 (self-merge)
      // 新逻辑: topCandidate=null → 不设 is_duplicate / duplicate_of
      eventRepo.findOne.mockResolvedValue(
        makeEvent({ nose_vector_id: 'v-1', animal_id: 'animal-only' }),
      );
      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-only',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 1.0,
            vector_similarity: 1.0,
            gps_similarity: 1.0,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];

      // 关键断言: 不应自合并
      expect(updateArg.is_duplicate).not.toBe(true);
      expect(updateArg.duplicate_of).toBeFalsy();
      expect(updateArg.animal_id).toBeFalsy();
    });

    it('【回归 BUG-005】event.animal_id 为 null 时不做自合并过滤(原 Bug6 候选池行为)', async () => {
      // 场景: report 事件或 collect 事件 animal_id=null 时不应过滤任何候选
      // 验证: animal_id=null 时直接走 top1 (无 self-merge 风险)
      eventRepo.findOne.mockResolvedValue(
        makeEvent({ nose_vector_id: null, animal_id: null }),
      );
      matchingService.findSimilarLostAnimalsForReport.mockResolvedValue([
        {
          animal_id: 'animal-report-1',
          breed: 'shiba',
          color: 'yellow',
          gender: 'male',
          status: 'lost',
          photos: ['/p/1.jpg'],
          address: 'Beijing',
          fusion_score: 0.85,
          scores: { image_similarity: null, gps_similarity: 0.9, text_match_rate: 0.66, time_score: 1.0 },
          distance_m: 120,
          is_recommended: true,
        },
      ]);

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];

      // animal_id=null → 不应有 self-merge 顾虑,top1 即 animal-report-1
      expect(updateArg.is_duplicate).toBe(true);
      expect(updateArg.duplicate_of).toBe('animal-report-1');
    });

    // ========== BUG-006 回归: vector_similarity 字段路径 ==========
    it('【回归 BUG-006】vector_similarity 应从 candidate.scores.vector_similarity 取值,不是顶层', async () => {
      // 场景: collect 流程的 update payload 中 vector_similarity 字段
      // 旧逻辑: candidates[0]?.vector_similarity (undefined) → 0
      // 新逻辑: candidates[0]?.scores?.vector_similarity → 0.91
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: 'v-1', animal_id: null }));
      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-1',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            // 注意: 鼻纹比对的原始结果把 vector_similarity 放在顶层
            fusion_score: 0.85,
            vector_similarity: 0.91,
            gps_similarity: 0.8,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];

      // 关键断言: updateArg.vector_similarity 应该是 0.91,不是 0 也不是 null
      expect(updateArg.vector_similarity).toBe(0.91);
      expect(updateArg.vector_similarity).not.toBe(0);
      expect(updateArg.vector_similarity).not.toBeNull();
    });

    it('【回归 BUG-006】GPS 仅 collect 流程赋值,report 流程保持 null', async () => {
      // 验证修复后没有破坏 collect/report 各自的字段语义
      eventRepo.findOne.mockResolvedValue(makeEvent({ nose_vector_id: null }));
      matchingService.findSimilarLostAnimalsForReport.mockResolvedValue([
        {
          animal_id: 'animal-r',
          breed: 'shiba',
          color: 'yellow',
          gender: 'male',
          status: 'lost',
          photos: ['/p/1.jpg'],
          address: 'Beijing',
          fusion_score: 0.7,
          scores: { image_similarity: null, gps_similarity: 0.92, text_match_rate: 0.5, time_score: 0.8 },
          distance_m: 50,
          is_recommended: false,
        },
      ]);

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];

      // report 流程 vector_similarity 永远为 null(无鼻纹)
      expect(updateArg.vector_similarity).toBeNull();
      // GPS 不为 null(从 candidates[0]?.scores?.gps_similarity 提取)
      expect(updateArg.gps_similarity).toBe(0.92);
    });
  });

  // ========== BUG-002 修复: create() 异步触发 processEvent + 幂等保护 ==========
  describe('BUG-002: create 后异步自动融合 + 幂等保护', () => {
    it('processEvent 已处理过(fusion_score 非空)应跳过,不再 update', async () => {
      // 场景: admin 手动 process 之后再调一次(或 setImmediate + admin 重复点)
      // 期望: 第二次进 processEvent 时 fusion_score 已经非空,应早返回,不再 increment / 不再 update
      eventRepo.findOne.mockResolvedValue(
        makeEvent({
          nose_vector_id: 'v-1',
          animal_id: null,
          fusion_score: 0.85,  // 已处理过
        }),
      );

      const result = await service.processEvent('event-1');

      // 不应再调 noseService.compare 或 matchingService
      expect(noseService.compare).not.toHaveBeenCalled();
      expect(matchingService.findSimilarLostAnimalsForReport).not.toHaveBeenCalled();
      // 不应再 update
      expect(eventRepo.update).not.toHaveBeenCalled();
      // 返回 fusion_score 为已有值,message 提示已处理
      expect(result.fusion_score).toBe(0.85);
      expect(result.message).toMatch(/已处理/);
    });

    it('create() 后应异步触发 processEvent(无需 admin 手动点)', async () => {
      // 场景: 用户调 POST /events 创建事件 → 不阻塞,后台自动 processEvent
      // 验证: 等待 setImmediate + processEvent 异步链跑完,eventRepo.update 被调
      eventRepo.save.mockImplementation(async (e: any) => e);

      // 第一次 findOne: processEvent 进来读事件(初始 fusion_score=null)
      // 第二次 findOne(若有): 我们的测试不需要,但防止实际跑重复
      let findOneCalls = 0;
      eventRepo.findOne.mockImplementation(async () => {
        findOneCalls++;
        if (findOneCalls === 1) {
          return makeEvent({
            event_id: 'auto-event-1',
            nose_vector_id: 'v-auto',
            animal_id: null,
            fusion_score: null,
          });
        }
        return makeEvent({
          event_id: 'auto-event-1',
          fusion_score: 0.83,  // 已处理
        });
      });

      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-auto-1',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 0.83,
            vector_similarity: 0.9,
            gps_similarity: 0.7,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      const dto = {
        event_type: 'report',
        species: 'dog',
        location_lat: 39.9,
        location_lng: 116.4,
        address: 'Beijing',
      };

      const result = await service.create(dto as any, 'user-1');
      expect(result.status).toBe('pending');

      // 等 setImmediate + processEvent 异步链完成
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      // 关键断言: eventRepo.update 被调(fusion_score 写入)
      const updateCalls = eventRepo.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      const updateArg = updateCalls[0][1];
      expect(updateArg.fusion_score).toBe(0.83);
      expect(updateArg.is_duplicate).toBe(true);
      expect(updateArg.duplicate_of).toBe('animal-auto-1');
    });

    it('create() 中 processEvent 抛错不应影响 POST /events 响应', async () => {
      // 场景: AI service 挂掉时,创建事件不能 500
      // 期望: catch error,只 logger.error,create() 照常返回 event_id
      eventRepo.save.mockImplementation(async (e: any) => e);

      // 让 processEvent 抛错 - findOne 报异常
      eventRepo.findOne.mockRejectedValue(new Error('AI service down'));

      const dto = {
        event_type: 'report',
        species: 'dog',
        location_lat: 39.9,
        location_lng: 116.4,
      };

      // 不应抛错
      const result = await service.create(dto as any, 'user-1');
      expect(result.event_id).toBeDefined();
      expect(result.status).toBe('pending');

      // 等异步链尝试跑完
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    });

    it('isMergeCandidate=true 时 rescue_events.animal_id 应正确指向目标(BUG-003 修复:report_count 自动 +1)', async () => {
      // 场景: processEvent 自动合并后,事件 animal_id 指向目标动物
      // 注意: report_count 是从 rescue_events 表 COUNT(*) 算出来的(animal.entity 无此列)
      // 所以只要 event.animal_id 设置正确,findAll/findOne 自然算到 count +1
      // 这里不需要 animalRepo.increment
      eventRepo.findOne.mockResolvedValue(
        makeEvent({ nose_vector_id: 'v-1', animal_id: null }),
      );
      noseService.compare.mockResolvedValue({
        results: [
          {
            animal_id: 'animal-target-1',
            animal: { breed: 'shiba', color: 'yellow', gender: 'male', status: 'lost' },
            fusion_score: 0.9,
            vector_similarity: 0.93,
            gps_similarity: 0.85,
            text_match_rate: 1.0,
            is_recommended: true,
          },
        ],
      });

      await service.processEvent('event-1');
      const updateArg = eventRepo.update.mock.calls[0][1];

      // 关键断言: event.animal_id 被设为目标
      expect(updateArg.animal_id).toBe('animal-target-1');
      expect(updateArg.duplicate_of).toBe('animal-target-1');
      expect(updateArg.is_duplicate).toBe(true);

      // 同时确保 animalRepo.increment 未被调(report_count 不在这里维护)
      expect(animalRepo.increment).toBeUndefined();
    });
  });

  // ========== 阶段 2 (2026-07-06): admin create_new 动作 — 创建 Animal from Event ==========
  describe('createAnimalFromEvent (阶段 2: admin create_new)', () => {
    it('应从 event 字段映射创建 Animal,并把 event.animal_id/status 更新', async () => {
      // 场景: admin 拿到 candidates=空 或 fusion<阈值 的事件 → 决定"创建新动物"
      // 期望: 把 event 字段 (species/breed/color/gender/location/photos/description/nose_vector_id)
      //       映射到 Animal 字段,通过 animalsService.create 建档
      //       然后 event.animal_id 指向新动物,event.status=confirmed
      eventRepo.findOne.mockResolvedValue(
        makeEvent({
          event_id: 'e-1',
          species: 'cat',
          breed: 'persian',
          color: 'white',
          gender: 'female',
          location_lat: 39.95,
          location_lng: 116.45,
          address: 'Shanghai',
          photos: ['/p/cat.jpg'],
          description: 'A stray cat',
          nose_vector_id: 'nose-v-1',
          animal_id: null,
          occurred_at: new Date('2026-07-01'),
        }),
      );
      animalsService.create.mockResolvedValue({ animal_id: 'new-animal-id-1' });

      const result = await service.createAnimalFromEvent('e-1');

      // 1. AnimalsService.create 被调,字段正确映射
      expect(animalsService.create).toHaveBeenCalledTimes(1);
      const createArg = animalsService.create.mock.calls[0][0];
      expect(createArg.species).toBe('cat');
      expect(createArg.breed).toBe('persian');
      expect(createArg.color).toBe('white');
      expect(createArg.gender).toBe('female');
      expect(createArg.location_lat).toBe(39.95);
      expect(createArg.location_lng).toBe(116.45);
      expect(createArg.address).toBe('Shanghai');
      expect(createArg.photos).toEqual(['/p/cat.jpg']);
      // event.description → Animal.notes
      expect(createArg.notes).toBe('A stray cat');
      // event.nose_vector_id → Animal.primary_nose_id (走 Stage 1 Bug6 兜底链路: 自动回填孤儿 NoseFeature)
      expect(createArg.primary_nose_id).toBe('nose-v-1');
      // event.occurred_at → first_seen_at + last_seen_at (DTO first_seen_at 是 IsDateString, 传 ISO 字符串)
      expect(createArg.first_seen_at).toBe('2026-07-01T00:00:00.000Z');
      expect(createArg.last_seen_at).toBe('2026-07-01T00:00:00.000Z');

      // 2. event.animal_id 和 status 应被更新
      expect(eventRepo.update).toHaveBeenCalledWith(
        { event_id: 'e-1' },
        expect.objectContaining({
          animal_id: 'new-animal-id-1',
          status: 'confirmed',
        }),
      );

      // 3. 返回值含 animal_id
      expect(result).toEqual({ animal_id: 'new-animal-id-1', event_id: 'e-1' });
    });

    it('event 不存在应抛 NotFoundException 且不调 animalsService.create', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.createAnimalFromEvent('missing-event')).rejects.toThrow('Event not found');
      expect(animalsService.create).not.toHaveBeenCalled();
      expect(eventRepo.update).not.toHaveBeenCalled();
    });

    it('event 有 gender 但无 color 应正常映射(部分字段缺失)', async () => {
      // 场景: 用户上报只有全身照 + GPS,没填颜色
      // 期望: color 传 undefined,AnimalsService.create 内部处理
      eventRepo.findOne.mockResolvedValue(
        makeEvent({ event_id: 'e-2', color: null, breed: null }),
      );
      animalsService.create.mockResolvedValue({ animal_id: 'partial-animal-id' });

      await service.createAnimalFromEvent('e-2');

      const createArg = animalsService.create.mock.calls[0][0];
      expect(createArg.color).toBeFalsy();
      expect(createArg.breed).toBeFalsy();
      expect(animalsService.create).toHaveBeenCalledTimes(1);
    });

    it('event 无 body_colors / photos 应传空数组/undefined(不崩)', async () => {
      // 场景: event 字段可能 null
      eventRepo.findOne.mockResolvedValue(
        makeEvent({ event_id: 'e-3', photos: null, body_colors: null }),
      );
      animalsService.create.mockResolvedValue({ animal_id: 'no-photos-id' });

      await service.createAnimalFromEvent('e-3');

      const createArg = animalsService.create.mock.calls[0][0];
      // photos: null → undefined (Animal 接受 null) 或 undefined (透传)
      expect(createArg.photos == null || Array.isArray(createArg.photos)).toBe(true);
      expect(eventRepo.update).toHaveBeenCalled();
    });
  });
});