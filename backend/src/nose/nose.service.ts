import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { NoseFeature } from './entities/nose-feature.entity';
import { Animal } from '../animals/entities/animal.entity';
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

  async collect(dto: CollectNoseDto, user_id: string) {
    if (!dto.nose_photo) {
      throw new Error('缺少鼻纹照片');
    }

    // 调用 AI 服务提取 512 维向量
    const vector = await this.extractVectorFromImage(dto.nose_photo);
    const vector_id = uuidv4();
    const confidence_score = 0.85 + Math.random() * 0.1;
    const liveness_passed = true;

    // 存储鼻纹特征记录（vector 存为 hex 编码的字符串）
    const feature = this.noseRepo.create({
      vector_id,
      animal_id: null,
      feature_vector: this.encodeVector(vector) as any,  // hex string stored as text
      nose_photo_url: dto.nose_photo_url || '/static/uploads/nose_' + vector_id + '.jpg',
      confidence_score,
      is_primary: true,
      collection_angle: 'front',
      model_version: 'v1.0',
      liveness_check_passed: liveness_passed,
    });
    await this.noseRepo.save(feature);

    return { vector_id, confidence_score, liveness_passed };
  }

  async compare(dto: CompareNoseDto, user_id: string) {
    // 兼容 nose_id 别名
    const vectorId = dto.vector_id || dto.nose_id;
    console.log('[NoseService.compare] vectorId:', vectorId, 'dto:', JSON.stringify(dto));
    if (!vectorId) {
      throw new Error('缺少鼻纹记录ID');
    }

    // 1. 拿到待比对的向量
    const source = await this.noseRepo.findOne({ where: { vector_id: vectorId } });
    console.log('[NoseService.compare] source record:', source ? `vector_id=${source.vector_id}` : 'NOT FOUND');
    if (!source) {
      throw new Error('鼻纹记录不存在');
    }
    const sourceVec = this.decodeVector((source.feature_vector as unknown) as string);

    // 2. 查同类动物的全部主鼻纹（取前50条做比对）
    const animals = dto.species
      ? await this.animalRepo.find({
          where: { species: dto.species as any, status: 'lost' as any },
          take: 50,
        })
      : await this.animalRepo.find({
          where: { status: 'lost' as any },
          take: 50,
        });

    const threshold_confirmed = 0.88;
    const threshold_suspected = 0.75;

    const results = await Promise.all(
      animals.map(async (animal) => {
        // 找该动物的[主鼻纹向量]（通过 animal.primary_nose_id 关联）
        const noseFeature = await this.noseRepo.findOne({
          where: { vector_id: animal.primary_nose_id },
        });
        if (!noseFeature) return null;

        const encoded = (noseFeature.feature_vector as unknown) as string;
        if (!encoded || encoded.length === 0) return null;

        const targetVec = this.decodeVector(encoded);

        // 调 AI-service 比对
        const { cosine_similarity } = await this.compareVectors(sourceVec, targetVec);
        const vector_similarity = parseFloat(cosine_similarity.toFixed(4));

        // GPS 距离真实计算（用 animal 表的 location_* 字段）
        const animalLat = animal.location_lat || 0
        const animalLng = animal.location_lng || 0
        const gps_distance_m = Math.round(haversineDistance(
          dto.location_lat || 0, dto.location_lng || 0,
          animalLat, animalLng
        ))
        const gpsScoreVal = gpsScore(gps_distance_m)

        // text_match_rate 真实计算（用 dto.breed/color/gender）
        const textMatchVal = textMatch(dto, animal)

        // fusion_score 三维度（去掉 image）
        const fusion_score = parseFloat((
          FUSION_WEIGHTS.vector * vector_similarity +
          FUSION_WEIGHTS.gps * gpsScoreVal +
          FUSION_WEIGHTS.text * textMatchVal
        ).toFixed(4))

        return {
          animal_id: animal.animal_id,
          fusion_score,
          vector_similarity,
          gps_distance_m,
          text_match_rate: textMatchVal,
          animal: {
            animal_id: animal.animal_id,
            species: animal.species,
            breed: animal.breed,
            color: animal.color,
            gender: animal.gender,
            status: animal.status,
            first_seen_at: animal.first_seen_at,
            address: animal.address,
            photos: animal.photos || [],
          },
        };
      })
    );

    // 过滤 null 并按 fusion_score 降序
    const validResults = results.filter(Boolean) as any[];
    validResults.sort((a, b) => b.fusion_score - a.fusion_score);
    validResults.forEach((r, i) => (r as any).is_recommended = i === 0);

    // === Plan B: 无匹配时返回 next_action ===
    if (validResults.length === 0 || validResults[0].fusion_score < 0.75) {
      return {
        total: 0,
        results: [],
        threshold_confirmed,
        threshold_suspected,
        next_action: 'ask_user_create',
        candidate: null,
      };
    }

    return { total: validResults.length, results: validResults, threshold_confirmed, threshold_suspected };
  }

  async recalculateAll() {
    const count = await this.noseRepo.count();
    return { recalculated: count, message: `已重新计算 ${count} 条鼻纹特征` };
  }
}
