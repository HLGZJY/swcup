-- Bug6 兜底修复: 清理历史脏数据
-- 用户已授权: 开发数据不重要, 可自行处理
-- 影响范围:
--   1. Animal 表 28 条 primary_nose_id=NULL 的记录 (DTO 字段缺失导致)
--   2. NoseFeature 表 11 条 animal_id=NULL 的孤儿记录
--   3. rescue_events 12 条 animal_id 指向将被删除的 animal
--   4. 上述孤儿鼻纹可能"指向"被删的 animal, 先把 animal_id 置 NULL, 再删

-- Step 1: 软断开 鼻纹与动物的引用 (防止 FK 失败)
UPDATE nose_features SET animal_id = NULL
  WHERE animal_id IN (SELECT animal_id FROM (SELECT animal_id FROM animals WHERE primary_nose_id IS NULL) AS t);

-- Step 2: 软断开 events 与动物的引用 (防止 FK 失败)
UPDATE rescue_events SET animal_id = NULL
  WHERE animal_id IN (SELECT animal_id FROM (SELECT animal_id FROM animals WHERE primary_nose_id IS NULL) AS t);

-- Step 3: 删 Animal (主档, 28 条)
DELETE FROM animals WHERE primary_nose_id IS NULL;

-- Step 4: 删孤儿 NoseFeature (11 条)
DELETE FROM nose_features WHERE animal_id IS NULL;

-- 验证
SELECT 'animals_total' AS metric, COUNT(*) AS cnt FROM animals
UNION ALL
SELECT 'animals_null_primary_nose_id', COUNT(*) FROM animals WHERE primary_nose_id IS NULL
UNION ALL
SELECT 'nose_features_total', COUNT(*) FROM nose_features
UNION ALL
SELECT 'nose_features_orphan', COUNT(*) FROM nose_features WHERE animal_id IS NULL
UNION ALL
SELECT 'events_no_animal_link', COUNT(*) FROM rescue_events WHERE animal_id IS NULL;
