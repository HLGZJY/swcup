import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { NoseFeature } from './entities/nose-feature.entity';
import { Animal } from '../animals/entities/animal.entity';
import { CollectNoseDto, CompareNoseDto } from './dto/nose.dto';

@Injectable()
export class NoseService {
  constructor(
    @InjectRepository(NoseFeature) private readonly noseRepo: Repository<NoseFeature>,
    @InjectRepository(Animal) private readonly animalRepo: Repository<Animal>,
  ) {}

  async collect(dto: CollectNoseDto, user_id: string) {
    // Mock AI response - 真实环境调用 FastAPI
    const vector_id = uuidv4();
    const confidence_score = 0.85 + Math.random() * 0.1;
    const liveness_passed = true;

    // 存储鼻纹特征记录
    const feature = this.noseRepo.create({
      vector_id,
      animal_id: null, // 先采集鼻纹，待关联动物
      feature_vector: Buffer.alloc(512),
      nose_photo_url: '/static/uploads/nose_' + vector_id + '.jpg',
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
    // Mock AI 比对结果 - 真实环境调用 FastAPI + 数据库向量
    const animals = await this.animalRepo.find();
    const threshold_confirmed = 0.88;
    const threshold_suspected = 0.75;

    const results = animals.slice(0, 5).map((animal, i) => {
      const fusion_score = parseFloat((0.90 - i * 0.08).toFixed(4));
      const vector_similarity = parseFloat((0.95 - i * 0.03).toFixed(4));
      const gps_distance_m = [320, 850, 1250, 1600, 2100][i] || 2000;
      const image_similarity = parseFloat((0.88 - i * 0.05).toFixed(4));
      const text_match_rate = parseFloat((0.80 - i * 0.04).toFixed(4));
      return {
        animal_id: animal.animal_id,
        fusion_score,
        vector_similarity,
        gps_distance_m,
        image_similarity,
        text_match_rate,
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
    });

    // 按 fusion_score 降序排列，最高分为推荐
    results.sort((a, b) => b.fusion_score - a.fusion_score);
    results.forEach((r, i) => {
      (r as any).is_recommended = i === 0;
    });

    return { total: results.length, results, threshold_confirmed, threshold_suspected };
  }

  async recalculateAll() {
    const count = await this.noseRepo.count();
    return { recalculated: count, message: `已重新计算 ${count} 条鼻纹特征` };
  }
}
