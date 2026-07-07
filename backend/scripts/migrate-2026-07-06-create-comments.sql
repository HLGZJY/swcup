-- =============================================
-- Migration: 新建 comments 表(评论功能) + 查询索引
-- 日期: 2026-07-06
-- 原因: Phase 0 Task 0.2 占位,首次落地基础 schema
--       Phase A Task A.1 补齐查询热点索引
--       对应 OpenAPI: docs/api/comments.openapi.yaml
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < scripts/migrate-2026-07-06-create-comments.sql
-- 幂等: CREATE TABLE IF NOT EXISTS + INFORMATION_SCHEMA 守卫, 可重复执行
-- 表 + 列级 CHECK + 索引均已落定
-- =============================================

USE nose_rescue;

CREATE TABLE IF NOT EXISTS comments (
  -- 主键: 36-char UUID 字符串, 由应用层 (TypeORM) 生成
  comment_id    CHAR(36) PRIMARY KEY,

  -- 关联动物: 与 animals.animal_id 对齐 (VARCHAR(36))
  animal_id     CHAR(36) NOT NULL,

  -- 评论用户: 与 users.user_id 对齐 (VARCHAR(36))
  reporter_id   CHAR(36) NOT NULL,

  content       TEXT NOT NULL,

  -- sentiment 枚举值严格对齐 OpenAPI (comments.openapi.yaml L78-80)
  sentiment     ENUM('care','seek','fake','thanks','report','neutral') NOT NULL DEFAULT 'neutral',

  is_hidden     BOOLEAN NOT NULL DEFAULT false,

  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  -- 内容长度 1~500 字符, 与 OpenAPI CreateCommentDto 一致
  CONSTRAINT chk_comments_content_length CHECK (CHAR_LENGTH(content) BETWEEN 1 AND 500),

  -- FK: 动物删除时级联删除其评论
  CONSTRAINT fk_comments_animal FOREIGN KEY (animal_id)
    REFERENCES animals(animal_id) ON DELETE CASCADE,

  -- FK: 评论者不强制 CASCADE (用户删除行为由应用层决定, 简单保护 + RESTRICT)
  CONSTRAINT fk_comments_reporter FOREIGN KEY (reporter_id)
    REFERENCES users(user_id)
);

-- 索引(查询热点)
-- MySQL 8.0 不支持 CREATE INDEX IF NOT EXISTS, 用 INFORMATION_SCHEMA + PREPARE 实现幂等
-- 1) 详情页评论流: 按动物 + 倒序时间, 直接覆盖 ORDER BY created_at DESC
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'comments'
    AND INDEX_NAME = 'idx_comments_animal_created'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_comments_animal_created ON comments (animal_id, created_at DESC)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) 详情页筛选可见评论: MySQL 8.0 不支持 partial index, 用复合索引 (animal_id, is_hidden)
--    查询 WHERE animal_id = ? AND is_hidden = 0 可命中此索引
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = 'nose_rescue'
    AND TABLE_NAME = 'comments'
    AND INDEX_NAME = 'idx_comments_animal_visible'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_comments_animal_visible ON comments (animal_id, is_hidden)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
