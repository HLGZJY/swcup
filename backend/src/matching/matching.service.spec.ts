import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MatchingService } from './matching.service';
import { Animal, AnimalStatus, Species } from '../animals/entities/animal.entity';
import { RescueEvent, EventType, EventStatus } from '../events/entities/event.entity';

function makeRepo() {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  return {
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
    gender: 'male' as any,
    first_seen_at: new Date('2026-06-01'),
    last_seen_at: new Date('2026-06-10'),
    location_lat: 39.9,
    location_lng: 116.4,
    address: 'Beijing',
    notes: null,
    tags: null,
    photos: ['/static/photos/1.jpg'],
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

describe('MatchingService', () => {
  let service: MatchingService;
  let animalRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    animalRepo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: ConfigService, useValue: { get: () => 'http://localhost:8000' } },
      ],
    }).compile();
    service = module.get<MatchingService>(MatchingService);
  });

  describe('findSimilarLostAnimalsForReport', () => {
    it('应只查 status=lost 的动物', async () => {
      animalRepo._qb.getMany.mockResolvedValue([]);
      await service.findSimilarLostAnimalsForReport(makeEvent(), 5);
      expect(animalRepo._qb.where).toHaveBeenCalledWith(
        'a.status = :status',
        { status: 'lost' },
      );
    });

    it('应按 species 过滤', async () => {
      animalRepo._qb.getMany.mockResolvedValue([]);
      await service.findSimilarLostAnimalsForReport(makeEvent({ species: 'cat' }), 5);
      expect(animalRepo._qb.andWhere).toHaveBeenCalledWith(
        'a.species = :species',
        { species: 'cat' },
      );
    });

    it('应有 GPS 坐标时增加 ±0.05 度的粗筛', async () => {
      animalRepo._qb.getMany.mockResolvedValue([]);
      await service.findSimilarLostAnimalsForReport(
        makeEvent({ location_lat: 39.9, location_lng: 116.4 }),
        5,
      );
      // latMin=39.85, latMax=39.95, lngMin=116.35, lngMax=116.45
      // 用 closeTo 容差,因为浮点加减可能产生微小误差
      expect(animalRepo._qb.andWhere).toHaveBeenCalledWith(
        'a.location_lat BETWEEN :latMin AND :latMax',
        expect.objectContaining({
          latMin: expect.any(Number),
          latMax: expect.any(Number),
        }),
      );
      const latCall = animalRepo._qb.andWhere.mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('a.location_lat BETWEEN'),
      );
      expect(latCall[1].latMin).toBeCloseTo(39.85, 5);
      expect(latCall[1].latMax).toBeCloseTo(39.95, 5);

      const lngCall = animalRepo._qb.andWhere.mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('a.location_lng BETWEEN'),
      );
      expect(lngCall[1].lngMin).toBeCloseTo(116.35, 5);
      expect(lngCall[1].lngMax).toBeCloseTo(116.45, 5);
    });

    it('无 GPS 坐标时不应做距离粗筛', async () => {
      animalRepo._qb.getMany.mockResolvedValue([]);
      await service.findSimilarLostAnimalsForReport(
        makeEvent({ location_lat: 0, location_lng: 0 }),
        5,
      );
      const calls = animalRepo._qb.andWhere.mock.calls;
      const hasBetween = calls.some(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('BETWEEN'),
      );
      expect(hasBetween).toBe(false);
    });

    it('无候选动物时应返回空数组', async () => {
      animalRepo._qb.getMany.mockResolvedValue([]);
      const result = await service.findSimilarLostAnimalsForReport(makeEvent(), 5);
      expect(result).toEqual([]);
    });

    it('高分候选(全匹配)应 fusion_score=1.0', async () => {
      const event = makeEvent({
        location_lat: 39.9,
        location_lng: 116.4,
        breed: 'shiba',
        color: 'yellow',
        gender: 'male' as any,
        occurred_at: new Date('2026-06-05'),
      });
      const animal = makeAnimal({
        location_lat: 39.9,
        location_lng: 116.4,
        breed: 'shiba',
        color: 'yellow',
        gender: 'male' as any,
        first_seen_at: new Date('2026-06-05'),
      });
      animalRepo._qb.getMany.mockResolvedValue([animal]);

      const result = await service.findSimilarLostAnimalsForReport(event, 5);
      expect(result[0].fusion_score).toBeGreaterThanOrEqual(0.99);
      expect(result[0].is_recommended).toBe(true);
      expect(result[0].scores.gps_similarity).toBe(1.0);
      expect(result[0].scores.time_score).toBe(1.0);
    });

    it('低分候选 fusion_score < 0.75 应 is_recommended=false', async () => {
      const event = makeEvent({
        location_lat: 39.9,
        location_lng: 116.4,
        breed: 'shiba',
        color: 'yellow',
      });
      // 8km 远 + 不同品种 + 不同颜色 + 时间差 6 天
      const animal = makeAnimal({
        location_lat: 39.97,
        location_lng: 116.45,
        breed: 'poodle',
        color: 'white',
        first_seen_at: new Date('2026-06-15'),
      });
      animalRepo._qb.getMany.mockResolvedValue([animal]);

      const result = await service.findSimilarLostAnimalsForReport(event, 5);
      expect(result[0].is_recommended).toBe(false);
    });

    it('多个候选应按 fusion_score 降序', async () => {
      const event = makeEvent({
        location_lat: 39.9,
        location_lng: 116.4,
        breed: 'shiba',
        color: 'yellow',
      });
      const close = makeAnimal({
        animal_id: 'close',
        location_lat: 39.901,
        location_lng: 116.401,
        breed: 'shiba',
        color: 'yellow',
      });
      const far = makeAnimal({
        animal_id: 'far',
        location_lat: 39.95,
        location_lng: 116.45,
        breed: 'poodle',
        color: 'white',
      });
      animalRepo._qb.getMany.mockResolvedValue([far, close]);

      const result = await service.findSimilarLostAnimalsForReport(event, 5);
      expect(result[0].animal_id).toBe('close');
      expect(result[1].animal_id).toBe('far');
      expect(result[0].fusion_score).toBeGreaterThanOrEqual(result[1].fusion_score);
    });

    it('应按 limit 截断', async () => {
      const event = makeEvent();
      const animals = Array.from({ length: 10 }, (_, i) =>
        makeAnimal({ animal_id: `a-${i}` }),
      );
      animalRepo._qb.getMany.mockResolvedValue(animals);

      const result = await service.findSimilarLostAnimalsForReport(event, 3);
      expect(result.length).toBe(3);
    });

    it('image_similarity 字段应永远 null(Bug 2026-06-13 决定)', async () => {
      const event = makeEvent();
      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      const result = await service.findSimilarLostAnimalsForReport(event, 5);
      expect(result[0].scores.image_similarity).toBeNull();
    });

    it('distance_m 应四舍五入到米', async () => {
      const event = makeEvent({
        location_lat: 39.9,
        location_lng: 116.4,
      });
      const animal = makeAnimal({
        location_lat: 39.9001,
        location_lng: 116.4001,
      });
      animalRepo._qb.getMany.mockResolvedValue([animal]);

      const result = await service.findSimilarLostAnimalsForReport(event, 5);
      // haversine 距离 ~14m
      expect(result[0].distance_m).toBeGreaterThan(0);
      expect(result[0].distance_m).toBeLessThan(100);
      expect(Number.isInteger(result[0].distance_m)).toBe(true);
    });
  });
});