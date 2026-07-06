-- =============================================
-- 鼻纹智救 测试数据准备脚本
-- 对应实际数据库字段（nose_features 用 vector_id，非 nose_id）
-- 运行方式：
--   docker exec -i nose-mysql mysql -uroot -prootpassword nose_rescue < /tmp/prepare_test_data.sql
-- =============================================

USE nose_rescue;

-- 1. 清空表（关闭外键检查）
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE nose_features;
TRUNCATE claims;
TRUNCATE rescue_events;
TRUNCATE animals;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. 保留3个测试账号（用户名手机号）
DELETE FROM users WHERE phone NOT IN ('13900000001', '13800000002', '13800000003');

-- 3. 创建测试动物档案（3只狗）
INSERT INTO animals (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized, first_seen_at, last_seen_at, location_lat, location_lng, address, notes, created_at, updated_at) VALUES
('a0000001-0001-0001-0001-000000000001', 'lost', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', true, '2026-05-10 08:00:00', '2026-05-13 10:00:00', 31.2304, 121.4737, '上海市静安区南京西路1788号', '豆豆，金毛犬，走失时佩戴蓝色项圈，尾巴尖有白毛', NOW(), NOW()),
('a0000002-0002-0002-0002-000000000002', 'lost', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', false, '2026-05-11 09:00:00', '2026-05-13 11:00:00', 31.2404, 121.4837, '上海市静安区北京西路100号', '旺财，棕色土狗，很温顺，左耳有缺口', NOW(), NOW()),
('a0000003-0003-0003-0003-000000000003', 'lost', 'dog', '萨摩耶', '白色', 'male', 'young', 'healthy', true, '2026-05-12 10:00:00', '2026-05-13 12:00:00', 31.2504, 121.4937, '上海市静安区华山路88号', '小白，萨摩耶，走失时穿着红色背心', NOW(), NOW());

-- 4. 采集鼻纹（每个动物3个样本，满足认领条件>=3）
-- 字段：vector_id, animal_id, nose_photo_url, is_primary, confidence_score, liveness_check_passed, ai_review_status, created_at
-- 狗A（豆豆）: 3个鼻纹
INSERT INTO nose_features (vector_id, animal_id, nose_photo_url, is_primary, confidence_score, liveness_check_passed, ai_review_status, created_at) VALUES
('n0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', '/ai-service/dog_nose/data/train/dog_nose/5EO4L89M5236.jpg', 1, 0.9523, 1, 'approved', NOW()),
('n0000002-0002-0002-0002-000000000002', 'a0000001-0001-0001-0001-000000000001', '/ai-service/dog_nose/data/train/dog_nose/07F9QU8H6PII.jpg', 0, 0.9100, 1, 'approved', NOW()),
('n0000003-0003-0003-0003-000000000003', 'a0000001-0001-0001-0001-000000000001', '/ai-service/dog_nose/data/train/dog_nose/XDHTNYV6A0WM.jpg', 0, 0.8900, 1, 'approved', NOW());

-- 狗B（旺财）: 3个鼻纹
INSERT INTO nose_features (vector_id, animal_id, nose_photo_url, is_primary, confidence_score, liveness_check_passed, ai_review_status, created_at) VALUES
('n0000004-0004-0004-0004-000000000004', 'a0000002-0002-0002-0002-000000000002', '/ai-service/dog_nose/data/train/dog_nose/4HG2RK8QJL0D.jpg', 1, 0.9340, 1, 'approved', NOW()),
('n0000005-0005-0005-0005-000000000005', 'a0000002-0002-0002-0002-000000000002', '/ai-service/dog_nose/data/train/dog_nose/XDHTNYV6A0WM.jpg', 0, 0.8800, 1, 'approved', NOW()),
('n0000006-0006-0006-0006-000000000006', 'a0000002-0002-0002-0002-000000000002', '/ai-service/dog_nose/data/train/dog_nose/5EO4L89M5236.jpg', 0, 0.8500, 1, 'approved', NOW());

-- 狗C（小白）: 3个鼻纹
INSERT INTO nose_features (vector_id, animal_id, nose_photo_url, is_primary, confidence_score, liveness_check_passed, ai_review_status, created_at) VALUES
('n0000007-0007-0007-0007-000000000007', 'a0000003-0003-0003-0003-000000000003', '/ai-service/dog_nose/data/val/dog_nose/0HOY6UPI03PO.jpg', 1, 0.9200, 1, 'approved', NOW()),
('n0000008-0008-0008-0008-000000000008', 'a0000003-0003-0003-0003-000000000003', '/ai-service/dog_nose/data/train/dog_nose/4HG2RK8QJL0D.jpg', 0, 0.8700, 1, 'approved', NOW()),
('n0000009-0009-0009-0009-000000000009', 'a0000003-0003-0003-0003-000000000003', '/ai-service/dog_nose/data/train/dog_nose/5EO4L89M5236.jpg', 0, 0.8600, 1, 'approved', NOW());

-- 5. 上报救助事件
-- 字段：event_id, animal_id, event_type, reporter_id, occurred_at, location_lat, location_lng, address, description, status, is_duplicate, created_at
INSERT INTO rescue_events (event_id, animal_id, event_type, reporter_id, occurred_at, location_lat, location_lng, address, description, status, is_duplicate, created_at) VALUES
('e0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', 'report', 'be1c7b3d-abb0-40b7-b36f-a10e102237e6', '2026-05-13 08:00:00', 31.2304, 121.4737, '上海市静安区南京西路1788号', '在小区内发现一只金毛犬，疑似走失，佩戴蓝色项圈，尾巴尖有白毛，很亲人', 'duplicated', 1, NOW()),
('e0000002-0002-0002-0002-000000000002', 'a0000002-0002-0002-0002-000000000002', 'report', 'be1c7b3d-abb0-40b7-b36f-a10e102237e6', '2026-05-13 09:00:00', 31.2404, 121.4837, '上海市静安区北京西路100号', '路边发现一只棕色土狗，很温顺，左耳有缺口，旁边有狗粮', 'rejected', 0, NOW()),
('e0000003-0003-0003-0003-000000000003', 'a0000003-0003-0003-0003-000000000003', 'report', 'be1c7b3d-abb0-40b7-b36f-a10e102237e6', '2026-05-13 10:00:00', 31.2504, 121.4937, '上海市静安区华山路88号', '路边发现一只萨摩耶，看起来像是走丢了，穿着红色背心，很干净', 'pending', 0, NOW());

-- 6. 认领申请（用户认领豆豆，状态pending）
-- 字段：claim_id, animal_id, claimer_id, event_id, claimed_at, status, notes, created_at
INSERT INTO claims (claim_id, animal_id, claimer_id, event_id, claimed_at, status, notes, created_at) VALUES
('c0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', 'be1c7b3d-abb0-40b7-b36f-a10e102237e6', 'e0000001-0001-0001-0001-000000000001', NOW(), 'pending', '这是我家的豆豆，三个月前从家里跑出去，佩戴蓝色项圈，尾巴尖有白毛，请好心人归还，必有重谢', NOW());