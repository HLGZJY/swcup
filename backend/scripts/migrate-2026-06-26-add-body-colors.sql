-- =============================================
-- Migration: 为 animals 表添加 body_colors JSON 字段
-- 日期: 2026-06-26
-- 原因: 报告页取色器升级 (取色器 v2), 用户可按身体部位
--       (背脊/腹部/头部/胸部/尾巴/四肢/面部) 采 3~7 个颜色,
--       提交时一并写入 body_colors JSON 数组, 供:
--         1. AI text_match 加权 (描述里出现"背脊棕色"比"棕色"更具体)
--         2. 详情页结构化展示
--       旧数据 (2026-06-26 之前) 只有单色, 落在 color 字段, body_colors 留 NULL
--       简单模式 (只采一个颜色) 也写 NULL, color 字段保留原行为
-- 运行: powershell -ExecutionPolicy Bypass -File run-sql.ps1
-- 幂等: 用 INFORMATION_SCHEMA 提前判断列是否存在, 重复执行不会报错
-- =============================================

USE nose_rescue;

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'animals'
    AND COLUMN_NAME = 'body_colors'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE animals ADD COLUMN body_colors JSON NULL COMMENT ''多部位取色 [{part,hex,label}, ...] 2026-06-26 取色器 v2'' AFTER color',
  'SELECT ''body_colors 已存在, 跳过''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
