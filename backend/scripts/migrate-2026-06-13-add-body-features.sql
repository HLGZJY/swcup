-- =============================================
-- Migration: 为 animals 表添加身体特征字段
-- 日期: 2026-06-13
-- 原因: Phase 1 调查发现 backend 实体新增的 size/coat_length/ear_type/tail_type
--       在 TypeORM synchronize:true 下未自动建列,需手动 ALTER TABLE
--       修复后 body 特征字段才能参与 text_match 加权打分
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < scripts/migrate-2026-06-13-add-body-features.sql
-- 幂等: 用 INFORMATION_SCHEMA 提前判断列是否存在, 重复执行不会报错
-- =============================================

USE nose_rescue;

-- 1. size (体型)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'animals'
    AND COLUMN_NAME = 'size'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE animals ADD COLUMN size ENUM(''small'', ''medium'', ''large'') NULL COMMENT ''体型''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. coat_length (毛长)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'animals'
    AND COLUMN_NAME = 'coat_length'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE animals ADD COLUMN coat_length ENUM(''short'', ''medium'', ''long'') NULL COMMENT ''毛长''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. ear_type (耳朵)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'animals'
    AND COLUMN_NAME = 'ear_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE animals ADD COLUMN ear_type ENUM(''erect'', ''floppy'') NULL COMMENT ''耳朵形态''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. tail_type (尾巴)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'animals'
    AND COLUMN_NAME = 'tail_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE animals ADD COLUMN tail_type ENUM(''long'', ''short'', ''curled'') NULL COMMENT ''尾巴形态''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
