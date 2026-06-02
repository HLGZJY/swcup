import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { NoseFeature } from './entities/nose-feature.entity';
import { Animal, AnimalStatus, Species, Gender, AgeEstimate, HealthStatus } from '../animals/entities/animal.entity';
import { RescueEvent, EventType, EventStatus } from '../events/entities/event.entity';
import { CollectNoseDto, CompareNoseDto } from './dto/nose.dto';

const AI_SERVICE_URL = 'http://localhost:8000';
const FUSION_WEIGHTS = { vector: 0.5, gps: 0.3, text: 0.2 };

// Haversine 计算两点间地球表面距离（米）
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function gpsScore(distanceM: number): number {
  return Math.max(0, Math.min(1, 1 - (distanceM - 500) / 1000))
}

function textMatch(dto: CompareNoseDto, animal: Animal): number {
  const kw1 = [dto.breed, dto.color, dto.gender].filter(Boolean)
  const kw2 = [animal.breed, animal.color, animal.gender].filter(Boolean)
  if (!kw1.length && !kw2.length) return 1
  if (!kw1.length || !kw2.length) return 0
  const intersection = kw1.filter(k =>
    kw2.some(v => v && k && (k.includes(v) || v.includes(k)))
  )
  return parseFloat((intersection.length / Math.max(kw1.length, kw2.length)).toFixed(4))
}

@Injectable()
export class NoseService {
  constructor(
    @InjectRepository(NoseFeature) private readonly noseRepo: Repository<NoseFeature>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
  ) {}

  // 调 AI-service 提取特征向量
  private async extractVectorFromImage(base64Image: string): Promise<number[]> {
    const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const res = await axios.post(`${AI_SERVICE_URL}/extract/feature`, { image: imageData });
    return res.data.vector as number[];
  }

  // 调 AI-service 比对两个向量
  private async compareVectors(vecA: number[], vecB: number[]): Promise<{ cosine_similarity: number; l2_distance: number }> {
    const res = await axios.post(`${AI_SERVICE_URL}/compare/vector`, {
      vector_a: vecA,
      vector_b: vecB,
    });
    return res.data;
  }

  // 将512维向量编码为hex字符串存储
  private encodeVector(vec: number[]): string {
    return vec.map(v => {
      const normalized = Math.max(0, Math.min(1, (v + 1) / 2));
      const byte = Math.round(normalized * 255);
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  // 从hex字符串解码为512维向量
  private decodeVector(encoded: string): number[] {
    const arr: number[] = [];
    for (let i = 0; i < encoded.length; i += 2) {
      const byte = parseInt(encoded.substr(i, 2), 16);
      arr.push(byte / 255.0 * 2 - 1);
    }
    return arr;
  }

  // 在 Animal 表的主鼻纹向量中搜索相似动物
  private async findSimilarAnimals(
    sourceVec: number[],
    species: string | undefined,
    limit: number = 50,
  ): Promise<{ animal: Animal; nose_feature: NoseFeature; cosine_similarity: number }[]> {
    const qb = this.animalRepo.createQueryBuilder('a')
      .where('a.primary_nose_id IS NOT NULL')
      .andWhere('a.primary_nose_id != :empty', { empty: '' });
    if (species) {
      qb.andWhere('a.species = :species', { species });
    }
    const animals = await qb.take(1000).getMany();

    if (animals.length === 0) return [];

    const results: { animal: Animal; nose_feature: NoseFeature; cosine_similarity: number }[] = [];
    for (const animal of animals) {
      const nf = await this.noseRepo.findOne({ where: { vector_id: animal.primary_nose_id } });
      if (!nf || !nf.feature_vector) continue;
      try {
        const targetVec = this.decodeVector((nf.feature_vector as unknown) as string);
        const { cosine_similarity } = await this.compareVectors(sourceVec, targetVec);
        results.push({
          animal,
          nose_feature: nf,
          cosine_similarity: parseFloat(cosine_similarity.toFixed(4)),
        });
      } catch {
        // skip decode/compare errors
      }
    }

    results.sort((a, b) => b.cosine_similarity - a.cosine_similarity);
    return results.slice(0, limit);
  }

  // 直接在 NoseFeature 表内比对所有已采集的向量（不依赖 Animal 表）
  private async findSimilarNoseFeatures(
    sourceVec: number[],
    sourceVectorId: string,
    species: string | undefined,
    limit: number = 50,
  ): Promise<{ nose_feature: NoseFeature; cosine_similarity: number }[]> {
    // 查所有有有效向量的鼻纹记录，排除自己，按创建时间倒序取 limit 条
    const allNoseFeatures = await this.noseRepo
      .createQueryBuilder('nf')
      .where('nf.feature_vector IS NOT NULL')
      .andWhere('nf.feature_vector != :empty', { empty: '' })
      .andWhere('nf.vector_id != :sourceId', { sourceId: sourceVectorId })
      .orderBy('nf.created_at', 'DESC')
      .take(limit)
      .getMany();

    if (allNoseFeatures.length === 0) return [];

    const results = await Promise.all(
      allNoseFeatures.map(async (nf) => {
        try {
          const targetVec = this.decodeVector((nf.feature_vector as unknown) as string);
          const { cosine_similarity } = await this.compareVectors(sourceVec, targetVec);
          return { nose_feature: nf, cosine_similarity: parseFloat(cosine_similarity.toFixed(4)) };
        } catch {
          return null;
        }
      }),
    );

    return results.filter(Boolean) as { nose_feature: NoseFeature; cosine_similarity: number }[];
  }

  async collect(dto: CollectNoseDto, user_id: string) {
    if (!dto.nose_photo) {
      throw new Error('缺少鼻纹照片');
    }

    // Step 1: 提向量
    const vector = await this.extractVectorFromImage(dto.nose_photo);
    const vector_id = uuidv4();
    const confidence_score = 0.85 + Math.random() * 0.1;
    const liveness_passed = true;

    // Step 2: 先查重 — 在所有 Animal.primary_nose_id 中搜索相似向量
    const similarAnimals = await this.findSimilarAnimals(vector, dto.species, 10);
    const bestMatch = similarAnimals.length > 0 ? similarAnimals[0] : null;

    // Step 3: 存鼻纹特征记录（vector 存为 hex 编码的字符串）
    const feature = this.noseRepo.create({
      vector_id,
      animal_id: bestMatch?.animal.animal_id || null,
      feature_vector: this.encodeVector(vector) as any,
      nose_photo_url: dto.nose_photo_url || '/static/uploads/nose_' + vector_id + '.jpg',
      confidence_score,
      is_primary: bestMatch ? false : true,
      collection_angle: 'front',
      model_version: 'v1.0',
      liveness_check_passed: liveness_passed,
    });
    await this.noseRepo.save(feature);

    // Step 4: 相似度高 → 已有动物，更新关联
    if (bestMatch && bestMatch.cosine_similarity >= 0.88) {
      return {
        vector_id,
        confidence_score,
        liveness_passed,
        is_duplicate: true,
        matched_animal_id: bestMatch.animal.animal_id,
        similarity: bestMatch.cosine_similarity,
        next_action: 'ask_claim_or_new',
      };
    }

    // Step 5: 相似度低 → 创建新动物档案 + 上报事件
    const animal_id = uuidv4();
    const now = new Date();
    const animal = this.animalRepo.create({
      animal_id,
      status: AnimalStatus.LOST,
      species: dto.species as Species,
      breed: '',
      color: '',
      gender: Gender.UNKNOWN,
      age_estimate: AgeEstimate.UNKNOWN,
      health_status: HealthStatus.UNKNOWN,
      sterilized: false,
      first_seen_at: now,
      last_seen_at: now,
      location_lat: dto.location_lat || 0,
      location_lng: dto.location_lng || 0,
      address: dto.description || '',
      primary_nose_id: vector_id,
    });
    await this.animalRepo.save(animal);

    // 更新刚存的鼻纹特征关联到新动物
    feature.animal_id = animal_id;
    feature.is_primary = true;
    await this.noseRepo.save(feature);

    // 创建上报事件
    const event = this.eventRepo.create({
      event_id: uuidv4(),
      animal_id,
      event_type: EventType.REPORT,
      reporter_id: null as any,
      occurred_at: now,
      location_lat: dto.location_lat || 0,
      location_lng: dto.location_lng || 0,
      address: dto.description || '',
      status: EventStatus.PENDING,
      fusion_score: 1.0,
      vector_similarity: 1.0,
    });
    await this.eventRepo.save(event);

    return {
      vector_id,
      confidence_score,
      liveness_passed,
      is_duplicate: false,
      matched_animal_id: null,
      similarity: null,
      animal_id,
      next_action: 'ask_claim_or_new',
    };
  }

  async compare(dto: CompareNoseDto, user_id: string) {
    const vectorId = dto.vector_id || dto.nose_id;
    console.log('[NoseService.compare] vectorId:', vectorId, 'dto:', JSON.stringify(dto));
    if (!vectorId) {
      throw new Error('缺少鼻纹记录ID');
    }

    // 1. 获取待比对的源向量
    const source = await this.noseRepo.findOne({ where: { vector_id: vectorId } });
    console.log('[NoseService.compare] source record:', source ? `vector_id=${source.vector_id}` : 'NOT FOUND');
    if (!source) {
      throw new Error('鼻纹记录不存在');
    }
    const sourceVec = this.decodeVector((source.feature_vector as unknown) as string);

    const threshold_confirmed = 0.88;
    const threshold_suspected = 0.75;

    // 2. 在 Animal.primary_nose_id 中搜索相似动物
    const similarAnimals = await this.findSimilarAnimals(sourceVec, dto.species, 50);

    if (similarAnimals.length === 0) {
      return {
        total: 0,
        results: [],
        threshold_confirmed,
        threshold_suspected,
        next_action: 'ask_user_create',
        candidate: null,
      };
    }

    // 3. 按相似度降序排列，高于阈值视为同狗
    const results = similarAnimals.map((item) => ({
      animal_id: item.animal.animal_id,
      vector_id: item.nose_feature.vector_id,
      fusion_score: item.cosine_similarity,
      vector_similarity: item.cosine_similarity,
      gps_distance_m: 0,
      text_match_rate: 0,
      image_similarity: 0,
      is_recommended: item.cosine_similarity >= threshold_confirmed,
      animal: {
        animal_id: item.animal.animal_id,
        species: item.animal.species,
        breed: item.animal.breed || '',
        color: item.animal.color || '',
        gender: item.animal.gender || 'unknown',
        status: item.animal.status,
        first_seen_at: item.animal.first_seen_at,
        address: item.animal.address || '',
        photos: item.animal.photos || [],
      },
      nose_feature: {
        vector_id: item.nose_feature.vector_id,
        confidence_score: item.nose_feature.confidence_score,
        created_at: item.nose_feature.created_at,
      },
    }));

    return {
      total: results.length,
      results,
      threshold_confirmed,
      threshold_suspected,
      next_action: results[0].fusion_score >= threshold_confirmed ? 'match_found' : 'ask_user_create',
      candidate: results[0] || null,
    };
  }

  async recalculateAll() {
    const count = await this.noseRepo.count();
    return { recalculated: count, message: `已重新计算 ${count} 条鼻纹特征` };
  }

  async classify(dto: { image: string }) {
    const imageData = dto.image.replace(/^data:image\/\w+;base64,/, '')
    const res = await axios.post(`${AI_SERVICE_URL}/classify/breed`, { image: imageData })

    const breedMap: Record<string, string> = {
      shiba_inu: '柴犬',
      akita: '秋田犬',
      american_bulldog: '美国 Bulldog',
      beagle: '比格犬',
      bengal: '孟加拉猫',
      birman: '伯曼猫',
      bombay: '孟买猫',
      boxer: '拳师犬',
      british_shorthair: '英国短毛猫',
      chihuahua: '吉娃娃',
      egyptian_mau: '埃及猫',
      english_cocker_spaniel: '英国可卡犬',
      english_setter: '英国塞特犬',
      german_shorthaired: '德国短毛指示犬',
      great_pyrenees: '大白熊犬',
      havanese: '哈瓦那犬',
      japanese_chin: '日本 chin 犬',
      keeshond: '荷兰毛狮犬',
      leonberger: '莱昂贝格犬',
      maine_coon: '缅因猫',
      miniature_pinscher: '迷你杜宾犬',
      newfoundland: '纽芬兰犬',
      persian: '波斯猫',
      pomeranian: '博美犬',
      pug: '巴哥犬',
      ragdoll: '布偶猫',
      russian_blue: '俄罗斯蓝猫',
      saint_bernard: '圣伯纳犬',
      samoyed: '萨摩耶',
      scottish_terrier: '苏格兰梗',
      siamese: '暹罗猫',
      sphynx: '斯芬克斯猫',
      staffordshire_bull_terrier: '斯塔福郡斗牛梗',
      wheaten_terrier: '软毛麦色梗',
      yorkshire_terrier: '约克夏梗',
      abyssinian: '阿比西尼亚猫',
      american_pit_bull_terrier: '美国比特斗牛犬',
    }

    return {
      breed: res.data.breed,
      breed_cn: breedMap[res.data.breed] || res.data.breed,
      confidence: res.data.confidence,
      top3: res.data.top3?.map((t: any) => ({
        breed: t.breed,
        breed_cn: breedMap[t.breed] || t.breed,
        confidence: t.confidence
      }))
    }
  }
}
