/**
 * 数据库 Seed 脚本
 * 运行方式: cd backend && npx ts-node src/seed.ts
 *
 * 直接使用原生 SQL 绕过 TypeORM enum 类型限制
 */
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

const AppDataSource = new DataSource({
  type: 'mysql',
  host: '127.0.0.1',
  port: 3307,
  username: 'root',
  password: 'rootpassword',
  database: 'nose_rescue',
  synchronize: false,
});

const TEST_ANIMALS = [
  { species: 'dog', breed: '吉娃娃', color: '黄白', gender: 'male' },
  { species: 'dog', breed: '马尔济斯', color: '白色', gender: 'female' },
  { species: 'dog', breed: '北京犬', color: '黄白', gender: 'male' },
  { species: 'dog', breed: '西施犬', color: '黑白', gender: 'female' },
  { species: 'dog', breed: '蝴蝶犬', color: '白棕', gender: 'male' },
  { species: 'dog', breed: '比格犬', color: '棕白', gender: 'male' },
  { species: 'dog', breed: '萨路基猎犬', color: '白色', gender: 'female' },
  { species: 'dog', breed: '黑褐猎浣熊犬', color: '黑褐', gender: 'male' },
  { species: 'cat', breed: '阿比西尼亚猫', color: '棕色', gender: 'male' },
  { species: 'cat', breed: '孟加拉猫', color: '金色', gender: 'female' },
  { species: 'cat', breed: '伯曼猫', color: '灰色', gender: 'female' },
  { species: 'cat', breed: '孟买猫', color: '黑色', gender: 'male' },
  { species: 'cat', breed: '英国短毛猫', color: '蓝色', gender: 'male' },
  { species: 'cat', breed: '埃及猫', color: '灰色', gender: 'female' },
  { species: 'cat', breed: '波斯猫', color: '白色', gender: 'female' },
  { species: 'cat', breed: '布偶猫', color: '白灰', gender: 'male' },
  { species: 'cat', breed: '俄罗斯蓝猫', color: '灰色', gender: 'female' },
  { species: 'cat', breed: '暹罗猫', color: '奶油色', gender: 'male' },
];

async function seed() {
  console.log('=== 开始 Seed ===');
  await AppDataSource.initialize();
  console.log('数据库连接成功');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  // 清空数据
  console.log('\n--- 清空数据 ---');
  await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryRunner.query('TRUNCATE TABLE rescue_events');
  await queryRunner.query('TRUNCATE TABLE nose_features');
  await queryRunner.query('TRUNCATE TABLE claims');
  await queryRunner.query('TRUNCATE TABLE animals');
  await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  数据已清空');

  console.log('\n--- 插入测试数据 ---');
  for (const data of TEST_ANIMALS) {
    // 每只动物独立生成 fake vector（512 维 × 2 字符 = 1024 字符），避免所有动物共享同一向量导致相似度恒为 1.0
    const fakeVec = Array.from({ length: 512 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

    const animalId = uuidv4();
    const vectorId = uuidv4();
    const eventId = uuidv4();

    const now = new Date();
    const lat = 39.9 + (Math.random() - 0.5) * 0.2;
    const lng = 116.4 + (Math.random() - 0.5) * 0.2;
    const address = `北京市朝阳区某街道${Math.floor(Math.random() * 100)}号`;
    const BASE_URL = 'http://127.0.0.1:3000';
    const bodyUrl = `${BASE_URL}/static/uploads/${encodeURIComponent(data.breed)}_1_body.jpg`;
    const noseUrl = `${BASE_URL}/static/uploads/${encodeURIComponent(data.breed)}_1_nose.jpg`;
    const tags = JSON.stringify([data.breed]);
    const photos = JSON.stringify([bodyUrl]);

    await queryRunner.query(
      `INSERT INTO animals (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized, first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags, photos, primary_nose_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [animalId, 'found', data.species, data.breed, data.color, data.gender, 'unknown', 'unknown', 0, now, now, lat, lng, address, `测试数据 - ${data.breed}`, tags, photos, vectorId]
    );

    await queryRunner.query(
      `INSERT INTO nose_features (vector_id, animal_id, feature_vector, nose_photo_url, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vectorId, animalId, fakeVec, noseUrl, 0.85 + Math.random() * 0.15, 1, 'front', 'v1.0', 1]
    );

    await queryRunner.query(
      `INSERT INTO rescue_events (event_id, animal_id, event_type, reporter_id, occurred_at, location_lat, location_lng, address, status, fusion_score, nose_vector_id, nose_photo_url, vector_similarity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, animalId, 'report', null, now, lat, lng, address, 'pending', 1.0, vectorId, noseUrl, 1.0]
    );

    console.log(`  ✓ ${data.breed} (${data.species})`);
  }

  console.log(`\n=== Seed 完成，共 ${TEST_ANIMALS.length} 条 ===`);
  await queryRunner.release();
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed 失败:', err);
  process.exit(1);
});