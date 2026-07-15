-- 2026-07-14 bug4: collect 三属性透传 → RescueEvent 加列
-- 与 backend/src/events/entities/event.entity.ts 字段声明保持一致
-- synchronize=true 已自动加列, 此文件供 ops 显式执行 / 生产环境回填

ALTER TABLE rescue_events
  ADD COLUMN age_estimate ENUM('junior','adult','senior','unknown') NULL,
  ADD COLUMN health_status ENUM('healthy','injured','sick','unknown') NULL,
  ADD COLUMN sterilized BOOLEAN NULL;
