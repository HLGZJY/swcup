-- 评论表 (依赖 phase A 完成)
-- 对应 OpenAPI: docs/api/comments.openapi.yaml
CREATE TABLE IF NOT EXISTS comments (
  comment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     UUID NOT NULL REFERENCES animals(animal_id) ON DELETE CASCADE,
  reporter_id   UUID NOT NULL REFERENCES users(user_id),
  content       TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  sentiment     VARCHAR(16) NOT NULL DEFAULT 'neutral',
  is_hidden     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- 索引在 A 实施时加,本任务仅列 schema