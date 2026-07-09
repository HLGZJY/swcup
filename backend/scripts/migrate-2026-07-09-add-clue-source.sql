-- =============================================
-- Migration: rescue_events.source ENUM 加 'clue' 值
-- 日期: 2026-07-09
-- 原因: 阶段 A 修复 — 线索审核 confirmed 时,落一条 source='clue' 的事件
--       进入 animal timeline,使线索→事件的关联在用户视角可见
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < scripts/migrate-2026-07-09-add-clue-source.sql
-- 幂等: 用 INFORMATION_SCHEMA.COLUMN_TYPE 提前判断是否已含 'clue',重复执行不会报错
-- =============================================

USE nose_rescue;

SET @col_type := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'rescue_events'
    AND COLUMN_NAME = 'source'
);

-- 仅当当前 ENUM 尚未包含 'clue' 时追加
SET @sql := IF(LOCATE('clue', @col_type) = 0,
  "ALTER TABLE rescue_events MODIFY COLUMN source ENUM('collect','report','collect_no_nose','user_create','sighting','claim','clue','admin') NOT NULL DEFAULT 'collect' COMMENT '事件来源'",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
