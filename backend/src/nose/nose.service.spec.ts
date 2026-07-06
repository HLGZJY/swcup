import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { NoseService } from './nose.service';
import { NoseFeature } from './entities/nose-feature.entity';
import { Animal, AnimalStatus, Species } from '../animals/entities/animal.entity';
import { RescueEvent, EventType, EventStatus } from '../events/entities/event.entity';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeNoseRepo() {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  };
  return {
    create: jest.fn((dto) => dto),
    save: jest.fn(async (e) => e),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
  };
}

function makeAnimalRepo() {
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

function makeEventRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
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
    primary_nose_id: 'primary-vector-1',
    created_at: new Date(),
    updated_at: new Date(),
    age_estimate: null,
    health_status: null,
    sterilized: false,
    size: 'medium' as any,
    coat_length: 'short' as any,
    ear_type: 'erect' as any,
    tail_type: 'curled' as any,
    ...overrides,
  } as Animal;
}

function makeNoseFeature(overrides: Partial<NoseFeature> = {}): NoseFeature {
  return {
    vector_id: 'v-1',
    animal_id: 'animal-1',
    feature_vector: 'ff'.repeat(128) as any,  // 256 chars = 128 hex bytes
    vector_dimension: 128,
    nose_photo_url: '/static/nose/1.jpg',
    body_photo_url: null,
    landmark_data: null,
    confidence_score: 0.9,
    is_primary: true,
    collection_angle: 'front' as any,
    model_version: 'v1.0',
    liveness_check_passed: true,
    created_at: new Date('2026-06-01'),
    ...overrides,
  } as NoseFeature;
}

describe('NoseService', () => {
  let service: NoseService;
  let noseRepo: ReturnType<typeof makeNoseRepo>;
  let animalRepo: ReturnType<typeof makeAnimalRepo>;
  let eventRepo: ReturnType<typeof makeEventRepo>;

  beforeEach(async () => {
    jest.resetAllMocks();  // 关键: 也要清 implementation, 否则 mockResolvedValueOnce 队列会跨测试残留
    noseRepo = makeNoseRepo();
    animalRepo = makeAnimalRepo();
    eventRepo = makeEventRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoseService,
        { provide: getRepositoryToken(NoseFeature), useValue: noseRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: ConfigService, useValue: { get: () => 'http://mock-ai' } },
      ],
    }).compile();

    service = module.get<NoseService>(NoseService);
  });

  // ========== collect ==========
  describe('collect', () => {
    it('【阶段 1】无 nose_photo 不抛错,而是返回 ask_user_confirm(场景 A:无鼻纹走失上报)', async () => {
      // 注意:这是行为变更。doc §6.1 规定 nose_photo 软化,
      // 缺失时跳过向量化,返回 next_action='ask_user_confirm',让前端决定怎么处理。
      const result = await service.collect({
        nose_photo: undefined,
        location_lat: 39.9,
        location_lng: 116.4,
        species: 'dog',
      } as any, 'user-1');

      // 不抛错,返回 next_action 供前端路由
      expect(result.next_action).toBe('ask_user_confirm');
      expect(result.vector_id).toBeNull();
      expect(result.is_duplicate).toBe(false);
      // 没向量化 → axios.extract 不该被调
      expect(mockedAxios.post).not.toHaveBeenCalled();
      // 鼻纹也不该入库
      expect(noseRepo.save).not.toHaveBeenCalled();
    });

    it('GPS=0 应抛 BadRequestException', async () => {
      await expect(service.collect({
        nose_photo: 'base64data',
        location_lat: 0,
        location_lng: 0,
      } as any, 'user-1'))
        .rejects.toThrow('有效的位置信息');
    });

    it('GPS 缺省应抛 BadRequestException', async () => {
      await expect(service.collect({
        nose_photo: 'base64data',
        location_lat: undefined,
        location_lng: undefined,
      } as any, 'user-1'))
        .rejects.toThrow('有效的位置信息');
    });

    it('【主链路】匹配已有动物(>=0.88) → ask_claim_or_new', async () => {
      // mock AI extract 返回向量
      mockedAxios.post.mockResolvedValueOnce({
        data: { vector: Array(128).fill(0.5) },
      });
      // mock AI compare 返回高相似度
      mockedAxios.post.mockResolvedValueOnce({
        data: { cosine_similarity: 0.95, l2_distance: 0.1 },
      });
      // 已有动物
      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      // 已有鼻纹
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      const result = await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
        species: 'dog',
      } as any, 'user-1');

      expect(result.is_duplicate).toBe(true);
      expect(result.similarity).toBe(0.95);
      expect(result.matched_animal_id).toBe('animal-1');
      expect(result.next_action).toBe('ask_claim_or_new');
    });

    it('【主链路】相似度 < 0.88 + 无孤儿 → ask_user_create (全新鼻纹)', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } });
      mockedAxios.post.mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } });
      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());
      // 孤儿表也无候选
      noseRepo._qb.getMany.mockResolvedValue([]);

      const result = await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      expect(result.is_duplicate).toBe(false);
      expect(result.matched_animal_id).toBeNull();
      expect(result.next_action).toBe('ask_user_create');
    });

    it('【Bug6 兜底】主链路未达阈值,但孤儿表有匹配 → ask_link_or_new', async () => {
      // 主链路: 0.5 (未达 0.88)
      mockedAxios.post
        .mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } })
        // 孤儿表 compare: 0.92
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.92, l2_distance: 0.1 } });

      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      // 孤儿表有未关联的鼻纹
      noseRepo._qb.getMany.mockResolvedValue([
        makeNoseFeature({ vector_id: 'orphan-1', animal_id: null }),
      ]);

      const result = await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      expect(result.is_duplicate).toBe(true);
      expect(result.next_action).toBe('ask_link_or_new');
      expect(result.matched_nose_id).toBe('orphan-1');
      expect(result.matched_animal_id).toBeNull();
    });

    it('【Bug6 兜底】孤儿表有匹配且 animal_id 非空 → ask_claim_existing', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.92, l2_distance: 0.1 } });

      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      noseRepo._qb.getMany.mockResolvedValue([
        makeNoseFeature({ vector_id: 'orphan-1', animal_id: 'animal-2' }),
      ]);

      const result = await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      expect(result.next_action).toBe('ask_claim_existing');
      expect(result.matched_animal_id).toBe('animal-2');
    });

    it('无任何匹配 → 应保存鼻纹并返回 next_action=ask_user_create', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } });
      animalRepo._qb.getMany.mockResolvedValue([]);
      noseRepo._qb.getMany.mockResolvedValue([]);

      const result = await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      expect(result.is_duplicate).toBe(false);
      expect(result.next_action).toBe('ask_user_create');
      expect(noseRepo.save).toHaveBeenCalled();
      const saved = noseRepo.save.mock.calls[0][0];
      expect(saved.animal_id).toBeNull();
      expect(saved.is_primary).toBe(true);  // 全新鼻纹 → primary=true
    });

    it('主链路 >=0.88 时新存鼻纹应 is_primary=false', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.95, l2_distance: 0.1 } });
      animalRepo._qb.getMany.mockResolvedValue([makeAnimal()]);
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      const saved = noseRepo.save.mock.calls[0][0];
      expect(saved.is_primary).toBe(false);  // 已匹配到动物 → 不再 primary
      expect(saved.animal_id).toBe('animal-1');  // 关联到匹配动物
    });

    it('confidence_score 应在 0.85-0.95 之间', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } });
      animalRepo._qb.getMany.mockResolvedValue([]);
      noseRepo._qb.getMany.mockResolvedValue([]);

      await service.collect({
        nose_photo: 'base64data',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      const saved = noseRepo.save.mock.calls[0][0];
      expect(saved.confidence_score).toBeGreaterThanOrEqual(0.85);
      expect(saved.confidence_score).toBeLessThanOrEqual(0.95);
    });

    it('应正确去除 base64 前缀(data:image/...)', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { vector: Array(128).fill(0.5) } });
      animalRepo._qb.getMany.mockResolvedValue([]);
      noseRepo._qb.getMany.mockResolvedValue([]);

      await service.collect({
        nose_photo: 'data:image/jpeg;base64,SUFFIX',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      // 第一次 axios.post 是 extract, 应去除 data:image/jpeg;base64, 前缀
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://mock-ai/extract/feature',
        expect.objectContaining({ image: 'SUFFIX' }),
      );
    });
  });

  // ========== compare ==========
  describe('compare', () => {
    it('无 vector_id / nose_id 应抛 BadRequestException', async () => {
      await expect(service.compare({}, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('鼻纹记录不存在应抛 NotFoundException', async () => {
      noseRepo.findOne.mockResolvedValue(null);
      await expect(service.compare({ vector_id: 'missing' }, 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('应支持 nose_id 字段别名', async () => {
      noseRepo.findOne.mockResolvedValue(null);
      await expect(service.compare({ nose_id: 'missing' }, 'user-1'))
        .rejects.toThrow(NotFoundException);
      expect(noseRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vector_id: 'missing' } }),
      );
    });

    it('【全空】无任何动物候选 → next_action=ask_user_create', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);
      animalRepo._qb.getMany.mockResolvedValue([]);
      noseRepo._qb.getMany.mockResolvedValue([]);

      const result = await service.compare({ vector_id: 'v-1' }, 'user-1');

      expect(result.total).toBe(0);
      expect(result.next_action).toBe('ask_user_create');
      expect(result.results).toEqual([]);
    });

    it('【高融合分】>=0.88 应 next_action=match_found', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);

      // AI extract (collect 不会调, 但这里 compare 直接复用 sourceVec)
      // AI compare: 0.95
      mockedAxios.post.mockResolvedValueOnce({ data: { cosine_similarity: 0.95, l2_distance: 0.1 } });

      const animal = makeAnimal({
        animal_id: 'animal-1',
        breed: 'shiba',
        color: 'yellow',
      });
      animalRepo._qb.getMany.mockResolvedValue([animal]);
      // nose.findOne 在 findSimilarAnimals 内被调,用于读 primary_nose_id 的 feature_vector
      // 注意 noseRepo.findOne 第一次是 compare 顶层查询 source, 之后是查目标鼻纹
      // 这里 source 已被 mockResolvedValueOnce, 所以再返回同一对象就行
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      const result = await service.compare({
        vector_id: 'v-1',
        location_lat: 39.9,
        location_lng: 116.4,
        breed: 'shiba',
        color: 'yellow',
      } as any, 'user-1');

      expect(result.total).toBeGreaterThan(0);
      expect(result.candidate.fusion_score).toBeGreaterThanOrEqual(0.88);
      expect(result.next_action).toBe('match_found');
    });

    it('融合分应 = 0.5*vector + 0.3*gps + 0.2*text', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);

      // vector=0.9
      mockedAxios.post.mockResolvedValueOnce({ data: { cosine_similarity: 0.9, l2_distance: 0.1 } });
      const animal = makeAnimal({
        location_lat: 39.9, location_lng: 116.4,
        breed: 'shiba', color: 'yellow',
      });
      animalRepo._qb.getMany.mockResolvedValue([animal]);
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      const result = await service.compare({
        vector_id: 'v-1',
        location_lat: 39.9,
        location_lng: 116.4,
        breed: 'shiba',
        color: 'yellow',
      } as any, 'user-1');

      const cand = result.results[0];
      // 验证 fusion_score 钳制在 [0,1] 且至少 0.5 * 0.9 = 0.45
      expect(cand.fusion_score).toBeGreaterThanOrEqual(0.45);
      expect(cand.fusion_score).toBeLessThanOrEqual(1);
      expect(cand.vector_similarity).toBe(0.9);
    });

    it('【Bug6 兜底】主链路未达阈值 + 孤儿表有匹配 → 应合并去重', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);

      // 主链路 compare: 0.5 (未达 0.88)
      mockedAxios.post
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } })
        // 孤儿 compare: 0.92
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.92, l2_distance: 0.1 } });

      // 主链路无候选(避免上面 jest.fn mock 计数错乱)
      animalRepo._qb.getMany.mockResolvedValue([]);
      // 孤儿表有匹配
      noseRepo._qb.getMany.mockResolvedValue([
        makeNoseFeature({ vector_id: 'orphan-1', animal_id: null }),
      ]);

      const result = await service.compare({
        vector_id: 'v-1',
        species: 'dog',
      } as any, 'user-1');

      expect(result.total).toBe(1);
      expect(result.results[0].is_orphan).toBe(true);
      // 孤儿无 animal 时, animal 字段应为占位对象
      expect(result.results[0].animal.animal_id).toBeNull();
      expect(result.results[0].animal.status).toBe('orphan');
    });

    it('孤儿候选 animal_id 已被补建档时,应使用真实 animal', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);

      mockedAxios.post
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.92, l2_distance: 0.1 } });

      animalRepo._qb.getMany.mockResolvedValue([]);
      noseRepo._qb.getMany.mockResolvedValue([
        makeNoseFeature({ vector_id: 'orphan-1', animal_id: 'animal-2' }),
      ]);

      const result = await service.compare({
        vector_id: 'v-1',
      } as any, 'user-1');

      // 关联 animal 已加载, animal 字段应是 Animal 对象
      expect(result.results[0].animal_id).toBe('animal-2');
      expect(result.results[0].is_orphan).toBe(false);
    });

    it('候选结果应按 fusion_score 降序', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);

      // 两次 compare: 0.7, 0.95
      mockedAxios.post
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.7, l2_distance: 0.5 } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.95, l2_distance: 0.1 } });

      const a1 = makeAnimal({ animal_id: 'animal-1', location_lat: 39.95, location_lng: 116.45 });
      const a2 = makeAnimal({ animal_id: 'animal-2', location_lat: 39.9001, location_lng: 116.4001 });
      animalRepo._qb.getMany.mockResolvedValue([a1, a2]);
      noseRepo.findOne.mockResolvedValue(makeNoseFeature());

      const result = await service.compare({
        vector_id: 'v-1',
        location_lat: 39.9,
        location_lng: 116.4,
      } as any, 'user-1');

      expect(result.results[0].animal_id).toBe('animal-2');  // 高 vector + 近 gps
    });

    it('【去重】同一动物出现在主链路+孤儿表 → 应合并', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);

      // 主链路和孤儿表各一次
      mockedAxios.post
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } })
        .mockResolvedValueOnce({ data: { cosine_similarity: 0.92, l2_distance: 0.1 } });

      animalRepo._qb.getMany.mockResolvedValue([makeAnimal({ animal_id: 'animal-1' })]);
      noseRepo._qb.getMany.mockResolvedValue([
        makeNoseFeature({ vector_id: 'orphan-1', animal_id: 'animal-1' }),
      ]);

      const result = await service.compare({ vector_id: 'v-1' } as any, 'user-1');

      // 不应重复
      const animal1Count = result.results.filter(r => r.animal_id === 'animal-1').length;
      expect(animal1Count).toBe(1);
    });

    it('is_recommended 阈值应为 0.88', async () => {
      const nf = makeNoseFeature({ feature_vector: 'ff'.repeat(128) as any });
      noseRepo.findOne.mockResolvedValue(nf);
      mockedAxios.post.mockResolvedValueOnce({ data: { cosine_similarity: 0.5, l2_distance: 1 } });

      animalRepo._qb.getMany.mockResolvedValue([]);
      noseRepo._qb.getMany.mockResolvedValue([]);

      const result = await service.compare({ vector_id: 'v-1' } as any, 'user-1');
      expect(result.threshold_confirmed).toBe(0.88);
      expect(result.threshold_suspected).toBe(0.75);
    });
  });

  // ========== classify ==========
  describe('classify', () => {
    it('应返回中文 breed_cn (shiba_inu → 柴犬)', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          breed: 'shiba_inu',
          confidence: 0.95,
          top3: [
            { breed: 'shiba_inu', confidence: 0.95 },
            { breed: 'akita', confidence: 0.04 },
          ],
        },
      });

      const result = await service.classify({ image: 'data:image/jpeg;base64,ABC' });
      expect(result.breed).toBe('shiba_inu');
      expect(result.breed_cn).toBe('柴犬');
      expect(result.top3[0].breed_cn).toBe('柴犬');
      expect(result.top3[1].breed_cn).toBe('秋田犬');
    });

    it('未知 breed 应回退到原英文名', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { breed: 'unknown_breed_xyz', confidence: 0.5 },
      });

      const result = await service.classify({ image: 'data:image/png;base64,XYZ' });
      expect(result.breed_cn).toBe('unknown_breed_xyz');
    });

    it('无 top3 时不应抛错', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { breed: 'poodle', confidence: 0.8 },
      });

      const result = await service.classify({ image: 'data:image/jpeg;base64,XYZ' });
      expect(result.breed_cn).toBe('poodle');
    });
  });

  // ========== recalculateAll ==========
  describe('recalculateAll', () => {
    it('应返回鼻纹总数', async () => {
      noseRepo.count.mockResolvedValue(42);
      const result = await service.recalculateAll();
      expect(result.recalculated).toBe(42);
      expect(result.message).toContain('42');
    });
  });
});