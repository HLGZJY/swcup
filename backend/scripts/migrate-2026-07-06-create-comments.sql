-- =============================================
-- Migration: 新建 comments 表(评论功能)
-- 日期: 2026-07-06
-- 原因: Phase 0 Task 0.2 占位,首次落地基础 schema
--       对应 OpenAPI: docs/api/comments.openapi.yaml
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < scripts/migrate-2026-07-06-create-comments.sql
-- 幂等: CREATE TABLE IF NOT EXISTS,可重复执行
-- 表 + 列级 CHECK 已落定;索引放到 Phase A-T1 再加
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
-- 索引在 Phase A-T1 加 (animal_id, created_at DESC) / (reporter_id, created_at DESC) 等
