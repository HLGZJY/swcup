-- =============================================
-- 鼻纹智救 - 迁移脚本 (2026-06-13)
-- 删除 users.avatar_url 列
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < migrate-2026-06-13-drop-avatar-url.sql
-- =============================================

USE nose_rescue;

ALTER TABLE users DROP COLUMN avatar_url;

-- 验证: 列已删
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA='nose_rescue' AND TABLE_NAME='users'
ORDER BY ORDINAL_POSITION;
