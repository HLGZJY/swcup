-- =============================================
-- Migration: 为 comments 表添加线索确认回写字段
-- 日期: 2026-07-09
-- 原因: 阶段 A 修复 — admin 线索审核 confirmed 路径需要回写
--       comments.is_clue_confirmed = true 与 clue_confirmed_animal_id,
--       以便前端展示「已确认关联」徽章 + 反查 animal
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < scripts/migrate-2026-07-09-add-clue-confirmed.sql
-- 幂等: 用 INFORMATION_SCHEMA 提前判断列是否存在, 重复执行不会报错
-- =============================================

USE nose_rescue;

-- 1. is_clue_confirmed
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'comments'
    AND COLUMN_NAME = 'is_clue_confirmed'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE comments ADD COLUMN is_clue_confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''线索已确认关联''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. clue_confirmed_animal_id
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'comments'
    AND COLUMN_NAME = 'clue_confirmed_animal_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE comments ADD COLUMN clue_confirmed_animal_id CHAR(36) NULL COMMENT ''线索确认时关联的 animal_id''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
