-- 2026-07-09 阶段 C: EventRecallService 全局兜底查询依赖 occurred_at 索引
-- 用途: 30 天内 status 合法的事件按时间倒序取 10 条
-- 配合: backend/src/events/entities/event.entity.ts @Index('idx_occurred_at', ['occurred_at'])

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'rescue_events'
    AND index_name = 'idx_occurred_at'
);

SET @ddl := IF(
  @exists = 0,
  'ALTER TABLE `rescue_events` ADD INDEX `idx_occurred_at` (`occurred_at`)',
  'SELECT ''idx_occurred_at already exists, skip'' AS msg'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
