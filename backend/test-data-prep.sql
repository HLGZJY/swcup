-- 按 2026-07-03-test-scenario-design.md §3.3 插入 10 只动物
-- A1/A2 不预填 primary_nose_id(由 S1/S2/S3 流程写入)
-- A6 不预填 primary_nose_id(由 S6 同区合并流程写入)

-- 先把 animals 表清空(spec §1 已 TRUNCATE,这里再确认)
SELECT COUNT(*) AS existing_animals FROM animals;

-- 读 .nose_v.json 作为参考(手工粘贴 vector_id)
SET @v_a1 = 'c11857b0-b9fc-4c5d-a637-6bc0a4c0b4d4';
SET @v_a3 = '90c621be-9e00-46f2-8810-c712fad9fca7';
SET @v_a4 = '9e29799b-9db6-4013-9950-f15bd4edac3a';
SET @v_a5 = '45ddf234-4079-4ead-af14-bf209d4f88f4';
SET @v_a7 = 'e12fe133-b197-42f4-a47f-a576fe1ac704';
SET @v_a8 = 'fd266196-312f-4c81-82ce-684813d7a600';
SET @v_a9 = '54b5ba97-d659-4106-a7d6-01f94f9c0762';
SET @v_a10 = '4ca583b6-f59a-48c9-96c8-2381617aee3a';

-- A1 豆豆 (lost, 静安公园, S1 由 user1 创建后会自动设置 primary_nose_id; 预录入时留空)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', 1,
   NOW(), NOW(), 31.2280, 121.4470,
   '上海市静安区南京西路 1788 号(静安公园)',
   '佩戴蓝色项圈,尾巴尖有白毛,亲人',
   '["走失","佩戴项圈","亲人"]',
   'large', 'long', 'floppy', 'long', NOW(), NOW());

-- A2 豆豆二次发现 (lost, 距A1 80m)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', 1,
   NOW(), NOW(), 31.2285, 121.4475,
   '上海市静安区南京西路 1788 号(静安公园)',
   '同豆豆,二次发现', '["走失","二次发现"]',
   'large', 'long', 'floppy', 'long', NOW(), NOW());

-- A3 大黄 (lost, 浦东金桥, primary_nose_id=aa3)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'dog', '拉布拉多', '黄色', 'male', 'adult', 'injured', 1,
   NOW(), NOW(), 31.2550, 121.5950,
   '上海市浦东新区金桥路 200 号',
   '右后腿受伤,行走缓慢,急需救助',
   '["走失","受伤","急需救助"]',
   'large', 'short', 'floppy', 'long', @v_a3, NOW(), NOW());

-- A4 小白 (found, 虹口四川北路, primary_nose_id=aa4)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'found', 'dog', '萨摩耶', '白色', 'male', 'adult', 'healthy', 1,
   NOW(), NOW(), 31.2650, 121.4980,
   '上海市虹口区四川北路 1888 号',
   '路边徘徊,穿红色背心,疑似走失',
   '["捡到","待认领"]',
   'medium', 'long', 'erect', 'long', @v_a4, NOW(), NOW());

-- A5 旺财 (lost, 徐汇衡山路, primary_nose_id=aa5)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', 0,
   NOW(), NOW(), 31.1950, 121.4350,
   '上海市徐汇区衡山路 999 号',
   '左耳有缺口,温顺,旁边有狗粮',
   '["走失","温顺"]',
   'medium', 'short', 'erect', 'long', @v_a5, NOW(), NOW());

-- A6 旺财二次发现 (lost, 距A5 100m, primary_nose_id 待 S6 自动合并)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', 0,
   NOW(), NOW(), 31.1958, 121.4358,
   '上海市徐汇区衡山路 999 号',
   '同旺财,二次发现', '["走失","二次发现"]',
   'medium', 'short', 'erect', 'long', NOW(), NOW());

-- A7 花花 (lost, 长宁中山公园, primary_nose_id=aa7)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'dog', '边牧', '黑白', 'female', 'adult', 'healthy', 1,
   NOW(), NOW(), 31.2200, 121.4180,
   '上海市长宁区中山公园',
   '走失 3 天,已联系主人认领',
   '["走失","已联系"]',
   'medium', 'medium', 'erect', 'long', @v_a7, NOW(), NOW());

-- A8 黑妞 (found, 闵行莘庄, primary_nose_id=aa8)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'found', 'dog', '柴犬', '黑色', 'female', 'adult', 'healthy', 0,
   NOW(), NOW(), 31.1100, 121.3820,
   '上海市闵行区莘庄镇莘建路 88 号',
   '棕色围脖,警觉,不让人靠近,需专业救助',
   '["捡到","警觉","需救助"]',
   'small', 'short', 'erect', 'curled', @v_a8, NOW(), NOW());

-- A9 咪咪 (lost, 同A1位置, 跨物种, primary_nose_id=aa9)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'lost', 'cat', '中华田园猫', '橘色', 'male', 'adult', 'healthy', 0,
   NOW(), NOW(), 31.2280, 121.4470,
   '上海市静安区南京西路 1788 号(静安公园)',
   '橘色狸花,胖胖的,佩戴粉色项圈',
   '["走失","佩戴项圈"]',
   'small', 'short', 'erect', 'long', @v_a9, NOW(), NOW());

-- A10 团子 (claimed, 普陀长寿路, primary_nose_id=aa10)
INSERT INTO animals
  (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized,
   first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags,
   size, coat_length, ear_type, tail_type, primary_nose_id, created_at, updated_at)
VALUES
  (UUID(), 'claimed', 'cat', '英短', '蓝灰色', 'female', 'adult', 'ill', 1,
   NOW(), NOW(), 31.2500, 121.3950,
   '上海市普陀区长寿路 200 号',
   '英短蓝猫,眼睛有分泌物,需治疗',
   '["走失","生病"]',
   'small', 'short', 'erect', 'short', @v_a10, NOW(), NOW());

SELECT '=== Summary ===' AS info;
SELECT animal_id, status, species, breed, color, location_lat, location_lng, primary_nose_id IS NOT NULL AS has_nose
FROM animals ORDER BY breed, created_at;