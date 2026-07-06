-- =============================================
-- 鼻纹智救 - 数据库填充脚本
-- 直接写入完整测试数据，不依赖任何 Python 包
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < seed.sql
-- =============================================

USE nose_rescue;

-- 1. 清空所有表
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE nose_features;
TRUNCATE TABLE claims;
TRUNCATE TABLE rescue_events;
TRUNCATE TABLE animals;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. 创建用户
INSERT INTO users (user_id, nickname, phone, role, created_at, updated_at) VALUES
('u-admin-0001-0000-0000-000000000001', '管理员A',          '13900000001', 'admin', '2026-04-01 10:00:00', '2026-05-13 12:00:00'),
('u-user1-0001-0000-0000-000000000002', '李明',            '13800000002', 'user',  '2026-04-05 10:00:00', '2026-05-13 12:00:00'),
('u-user2-0001-0000-0000-000000000003', '王小红',          '13800000003', 'user',  '2026-04-06 10:00:00', '2026-05-13 12:00:00'),
('u-user3-0001-0000-0000-000000000004', '张小华',          '13800000004', 'user',  '2026-04-07 10:00:00', '2026-05-13 12:00:00'),
('u-user4-0001-0000-0000-000000000005', '陈建国',          '13800000005', 'user',  '2026-04-08 10:00:00', '2026-05-13 12:00:00'),
('u-user5-0001-0000-0000-000000000006', '刘秀英',          '13800000006', 'user',  '2026-04-09 10:00:00', '2026-05-13 12:00:00'),
('u-user6-0001-0000-0000-000000000007', '赵大力',          '13800000007', 'user',  '2026-04-10 10:00:00', '2026-05-13 12:00:00'),
('u-user7-0001-0000-0000-000000000008', '周小燕',          '13800000008', 'user',  '2026-04-11 10:00:00', '2026-05-13 12:00:00'),
('u-org1--0001-0000-0000-000000000009', '上海宠物救助站',  '13800000010', 'org',   '2026-03-01 10:00:00', '2026-05-13 12:00:00'),
('u-org2--0001-0000-0000-000000000010', '北京流浪动物保护中心','13800000011', 'org',  '2026-03-10 10:00:00', '2026-05-13 12:00:00');

-- 3. 创建动物档案 (12只: 9狗3猫，覆盖不同状态)
INSERT INTO animals (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized, first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags, photos, size, coat_length, ear_type, tail_type, created_at, updated_at) VALUES

-- 狗: 走失
('a-00001-0001-0001-000000000001', 'lost',    'dog', '金毛',     '金色',   'male',   'adult',  'healthy', true,  '2026-05-08 08:00:00', '2026-05-10 10:00:00', 31.2304, 121.4737, '上海市静安区南京西路1788号',     '走失时佩戴蓝色项圈，尾巴尖有白毛，很亲人',          '[\"走失\", \"佩戴项圈\", \"亲人\"]',    '[]', 'large',  'long',   'floppy', 'long',   '2026-05-08 08:00:00', '2026-05-10 10:00:00'),
('a-00002-0002-0002-000000000002', 'lost',    'dog', '土狗',     '棕色',   'female', 'adult',  'healthy', false, '2026-05-10 09:00:00', '2026-05-11 11:00:00', 31.2404, 121.4837, '上海市静安区北京西路100号',      '左耳有缺口，很温顺，旁边有狗粮',                    '[\"走失\", \"温顺\"]',              '[]', 'medium', 'short',  'erect',  'curled', '2026-05-10 09:00:00', '2026-05-11 11:00:00'),
('a-00003-0003-0003-000000000003', 'lost',    'dog', '萨摩耶',   '白色',   'male',   'adult',  'healthy', true,  '2026-05-11 10:00:00', '2026-05-12 12:00:00', 31.2504, 121.4937, '上海市静安区华山路88号',         '走失时穿红色背心，很干净，毛发洁白',                 '[\"走失\", \"穿背心\"]',            '[]', 'medium', 'long',   'erect',  'curled', '2026-05-11 10:00:00', '2026-05-12 12:00:00'),
('a-00004-0004-0004-000000000004', 'lost',    'dog', '拉布拉多', '黄色',   'male',   'adult',  'injured', true,  '2026-05-12 08:00:00', '2026-05-13 09:00:00', 31.2604, 121.5037, '上海市浦东新区世纪大道200号',    '右后腿受伤，行走缓慢，急需救助',                     '[\"走失\", \"受伤\", \"急需救助\"]',  '[]', 'large',  'short',  'floppy', 'long',   '2026-05-12 08:00:00', '2026-05-13 09:00:00'),
('a-00005-0005-0005-000000000005', 'lost',    'dog', '柴犬',     '黑色',   'female', 'adult',  'healthy', false, '2026-05-09 08:00:00', '2026-05-10 18:00:00', 31.2104, 121.4637, '上海市徐汇区淮海中路999号',     '棕色围脖，很警觉，不让人靠近',                       '[\"走失\", \"警觉\"]',              '[]', 'small',  'short',  'erect',  'curled', '2026-05-09 08:00:00', '2026-05-10 18:00:00'),
('a-00006-0006-0006-000000000006', 'lost',    'dog', '哈士奇',   '灰白',   'male',   'adult',  'healthy', true,  '2026-05-12 14:00:00', '2026-05-13 16:00:00', 31.2804, 121.5237, '上海市浦东新区张江镇碧波路',    '蓝色眼睛，胖胖的，很亲人，在路边找水喝',             '[\"走失\", \"亲人\"]',              '[]', 'medium', 'medium', 'erect',  'curled', '2026-05-12 14:00:00', '2026-05-13 16:00:00'),
('a-00007-0007-0007-000000000007', 'lost',    'dog', '泰迪',     '棕色',   'female', 'adult',  'healthy', false, '2026-05-11 10:00:00', '2026-05-12 15:00:00', 31.2304, 121.4837, '上海市静安区陕西北路100号',    '剪了造型，很干净，疑似走失',                         '[\"走失\"]',                      '[]', 'small',  'medium', 'floppy', 'short',  '2026-05-11 10:00:00', '2026-05-12 15:00:00'),

-- 狗: 已找到/已认领
('a-00008-0008-0008-000000000008', 'claimed', 'dog', '边牧',     '黑白',   'female', 'adult',  'healthy', true,  '2026-05-03 10:00:00', '2026-05-05 14:00:00', 31.2204, 121.4537, '上海市长宁区延安西路100号',    '被人捡到，已联系主人认领',                           '[\"捡到\", \"已认领\"]',            '[]', 'medium', 'medium', 'erect',  'long',   '2026-05-03 10:00:00', '2026-05-05 14:00:00'),
('a-00009-0009-0009-000000000009', 'found',   'dog', '柯基',     '黄白',   'male',   'puppy',  'healthy', false, '2026-05-07 09:00:00', '2026-05-08 11:00:00', 31.2704, 121.5137, '上海市闵行区莘庄镇莘建路88号',  '走失小狗，在路边徘徊，疑似与主人走散',               '[\"捡到\", \"待认领\"]',            '[]', 'small',  'medium', 'erect',  'short',  '2026-05-07 09:00:00', '2026-05-08 11:00:00'),

-- 猫
('a-00010-0010-0010-000000000010', 'lost',    'cat', '中华田园猫','橘色',  'male',   'adult',  'healthy', false, '2026-05-06 10:00:00', '2026-05-08 16:00:00', 31.2304, 121.4637, '上海市静安区新闸路200号',      '橘色狸花，胖胖的，佩戴粉色项圈',                     '[\"走失\", \"佩戴项圈\"]',          '[]', 'medium', 'short',  'erect',  'long',   '2026-05-06 10:00:00', '2026-05-08 16:00:00'),
('a-00011-0011-0011-000000000011', 'lost',    'cat', '英短',     '蓝灰色', 'female', 'adult',  'ill',     true,  '2026-05-10 09:00:00', '2026-05-11 14:00:00', 31.2404, 121.4737, '上海市静安区昌平路50号',       '眼睛有分泌物，精神不佳，疑似生病',                   '[\"走失\", \"生病\"]',              '[]', 'medium', 'short',  'erect',  'short',  '2026-05-10 09:00:00', '2026-05-11 14:00:00'),
('a-00012-0012-0012-000000000012', 'found',   'cat', '波斯猫',   '白色',   'male',   'senior', 'healthy', true,  '2026-05-05 10:00:00', '2026-05-07 13:00:00', 31.2504, 121.4837, '上海市静安区江宁路88号',        '纯白波斯猫，很温顺，在长椅上晒太阳',                 '[\"捡到\", \"待找主人\"]',          '[]', 'medium', 'long',   'floppy', 'long',   '2026-05-05 10:00:00', '2026-05-07 13:00:00');

-- 4. 创建鼻纹特征 (每个动物3-5个样本)
-- 狗A: 豆豆
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00001-0001-0001-000000000001', 'a-00001-0001-0001-000000000001', 0xc8844bf0fa7502754230c73cc0a758ba86451f748c21634b1b1e41c4bbbaf37f00744544a173730a16a0106c97500f7e3f9c0c9643c49f14da8d42fc6df6e4277a8909e80d40870a3d5bcbd43bc854032aafe0f2a1e074b4c314bb6d7a0e962c0a765349a4f763630a211079ccf4681bb6cd7312e4aca0d5d5ead3c14a5d75be, 128, '/static/uploads/nose/dog_001.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9523, true,  'front', 'v1.0.0', true, '2026-05-08 09:00:00'),
('v-00002-0002-0002-000000000002', 'a-00001-0001-0001-000000000001', 0x9e97abe6ce06f94898e31ff11c078dbe32611842efc3ba80de3a84957d61760e6af437c7518c898bf10a51bfe8e9c6246278ed7e10c8c3c00728639c334b6cfa95fbbcc2e7488c7908c3969c133854b3200a6880baebbd5fb89bc43c2fc5745d8e5887a899045eaabb5f356d778da9cf6656aded92104111481fba06b07def54, 128, '/static/uploads/nose/dog_002.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9100, false, 'left',  'v1.0.0', true, '2026-05-08 10:00:00'),
('v-00003-0003-0003-000000000003', 'a-00001-0001-0001-000000000001', 0xcd474d59b98c50fec658e32e5aa8bb54b93708553aee849405e70f9cf9a761b34f74afdb37af01ed315f8194ccec510c0c4df61a760c8cd5e32b77459edf0f7b6ec396c55ff920386692524ef38deadce77d54fcae778f26c09e2b40cbe891664c42b8e715d55b15b932e2d583dedf1be17fcd874c392c8ca6c472164b85afde, 128, '/static/uploads/nose/dog_003.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8900, false, 'right', 'v1.0.0', true, '2026-05-08 11:00:00'),
('v-00004-0004-0004-000000000004', 'a-00001-0001-0001-000000000001', 0xe098074fd16f80ccc18ff083a26cc1e95330b28c8e0f10fec1a39ec814ad324f57e112be0d20d7cc6bee914acb47c2bdae5ba92032909824fb2d3ac5accae9381e7fd3ee2f35e6a18f02d2c54d69753b7858a4629d855a107cc3493f443210b58d4c0aec9a04df9c5be827e97f0911821f67f65351aa45f9cc33bfc7ae846fd0, 128, '/static/uploads/nose/dog_004.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8700, false, 'front', 'v1.0.0', false,'2026-05-09 09:00:00');

-- 狗B: 旺财
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00005-0005-0005-000000000005', 'a-00002-0002-0002-000000000002', 0x7feffbe715b6ca766993d202cb2d81dc4102797c02f9e2b4a47196b0b6596173bd0e618c1ba76c076a86f62e8e95009db47cc95308b078e29b8fdb3f7501c375f0306d9f6858700afd2ac34c5d437a9003c8db289e768f2fc4dc682390c52a435124a0c78964a9544ecea86b9d8babb5d8f04c937f49b2d0d46f7a095251b6d2, 128, '/static/uploads/nose/dog_002.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9340, true,  'front', 'v1.0.0', true, '2026-05-10 10:00:00'),
('v-00006-0006-0006-000000000006', 'a-00002-0002-0002-000000000002', 0x1457ba3287c95bc9bd079071acc2d275a2be5ad85fb12039ca40ee569d33a2437ba8679316a32b6162f83c2ef27f7cba1f894084a8794b90959b04fb2be3d88e53db3c2598fa3b2abe560b523f2e74fbffd81707e53a31a5edf0c5ce5e31bd2ac8167cf7638708d3c011cf3edc6c7b28aa3df39edcfb5c9c38de2388abcb08d3, 128, '/static/uploads/nose/dog_003.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8800, false, 'left',  'v1.0.0', true, '2026-05-10 11:00:00'),
('v-00007-0007-0007-000000000007', 'a-00002-0002-0002-000000000002', 0x5cb55332e0610d1e26532ce6d51f17904b8d1ea660016c56572213fa6ad52ab74f1f4d2c2e00af7b725b407ec8ed899b76a46fa0c64cfc4f95aed1f9ee0c6c511b7a3b0f5d608ac9c5c24fb751a94b46264e01ffa4aeb5cbb63f0709bdeebcf47e0b6f8066e80b31ee56e1fb8139cb748ec6ccec7adcfcdd4f301d98e36f0fe6, 128, '/static/uploads/nose/dog_001.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8500, false, 'right', 'v1.0.0', true, '2026-05-11 09:00:00');

-- 狗C: 小白
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00008-0008-0008-000000000008', 'a-00003-0003-0003-000000000003', 0x3bf4c33398e27a2ecc378045e9d85864286cc4c21d05586239b79d5c292581d013b84c83efbd675be11ebab7c8449543a6cac8baa9baada4eb3ddf9c46777c8287f343f68ddcdaaface3a80cb286508765e0951929888137f1ac044fdcf17a3c7b21cfbd5bd99c3ec6506bc52e150866f1922a6bc092d35ae394a299d5b85dbc, 128, '/static/uploads/nose/dog_003.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9200, true,  'front', 'v1.0.0', true, '2026-05-11 11:00:00'),
('v-00009-0009-0009-000000000009', 'a-00003-0003-0003-000000000003', 0xf4a7ad510c59a00a4ea83dd488dfc781d543ad0693683ab4961bae33a1b3f3efe6fb4b12e7b2ced490eeb9b21bf4d8c75573ba73e82921073cba9ab9fda256a4c28a7ef6b99560bfc552a893c1d3cc0bbec5afa6110e2e50d812153c33f9e9d8ac96d4b720d7ef5353b288dfd023deb8a19ca14eb52080784288ecfc7292bd46, 128, '/static/uploads/nose/dog_004.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8700, false, 'left',  'v1.0.0', true, '2026-05-11 12:00:00'),
('v-00010-0010-0010-000000000010', 'a-00003-0003-0003-000000000003', 0x8dcf76a96182e54f12d193c0ba7f39970ad7c903b9fa5865e83a05df89c68295c3e684b6cdf4110c291e44e41489baa48c752d38f79a3cd0ccab7c966020dcc4423b3ff326f08b4b4a5f7e64398d8986d806daa23ba4067d491d70e1fd7e13e52ec554dc3df417c0c7ad31cecd183470b00c24f14f75a0603832489e1552564b, 128, '/static/uploads/nose/dog_005.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8600, false, 'right', 'v1.0.0', true, '2026-05-12 10:00:00');

-- 狗D: 大黄
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00011-0011-0011-000000000011', 'a-00004-0004-0004-000000000004', 0xd2cce169631b325c24c1ee39eca43e688e96b04d46fdfecf2f2044bf7736e11c1017fbe96fda6a550ca43a30c7a22180803edb18c34fae78b70308a96a0c4aa3c1bc5f7e8d0117e8d5390045527e232371350cb21985e475351d1fb55bc67db42ff064a1d8b2b9fa2dede57d6a682f9bf8814d635418c283ba891f6537bdb1cb, 128, '/static/uploads/nose/dog_004.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9150, true,  'front', 'v1.0.0', true, '2026-05-12 09:00:00'),
('v-00012-0012-0012-000000000012', 'a-00004-0004-0004-000000000004', 0xe07ef8d69658b7ae2c0a69419f08087ffeac301a465402f67bfed1203e5f7c2d20800a3a7bd95677d0bfae74106af88a30f512b0164eb8bf9f6ac4cb0f94eab9eea5d48e85670021e4f9b9071b6be09e1d267150528db7c97a496ba4eb96f1339333d3651b726f0213af9600eb6a2d028ad85e570a7b037bffb2072f5b6a7d3b, 128, '/static/uploads/nose/dog_005.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8600, false, 'left',  'v1.0.0', true, '2026-05-12 10:00:00'),
('v-00013-0013-0013-000000000013', 'a-00004-0004-0004-000000000004', 0x9e6df665ed24ed6ed34b39bd39b871a3ff432900e50baf2faa16e1e8de0faafa7bc64a0a74b0cba2ac0da0b34a220d3d40a5ad01999a734c66abd086f4ba6af8fc7d31a8c760c836274199988f5ce8444a300d733d472fb86e4eb0a99aa22f8341359a0a222f08fd443019ffc33724b15c10fa133a2e855ee2087f374a01cd43, 128, '/static/uploads/nose/dog_001.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8300, false, 'right', 'v1.0.0', false,'2026-05-13 08:00:00');

-- 狗E: 黑妞
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00014-0014-0014-000000000014', 'a-00005-0005-0005-000000000005', 0x1294cc9e26bb928ec19f16a89b3b07bb7d82687cbccbc51a604f648d082ca331e169dd1134ba06d8ec582a8727f1020a45414b3aba4c330a2cbd362402dc8b182672604b29e8837828eacfeabce3ee3068dc207024efa0f93cf5ae6ac8f054ba4360771d99d6b62c2e4cda1d81242e1faf3e5cce44314ed022e9d56bc1717520, 128, '/static/uploads/nose/dog_005.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9400, true,  'front', 'v1.0.0', true, '2026-05-09 09:00:00'),
('v-00015-0015-0015-000000000015', 'a-00005-0005-0005-000000000005', 0x5a9ec272ebb8cbb0bec321c91bdc90e295956ee3cb912fb5215d1aa93170d35980926e92e61ec2f6afe5ef1eeeb86306a44278be3866ed2cadf1881c947b763dbd3047dbce6702587a3b00ec8ee4e61243644bfd0e0bd268daed7f6aac5e3f7aeb9dbbba39765c8d76fdcb62cbd419b79ecfe5bbecc0a5ee2c25c8dbd4eacb66, 128, '/static/uploads/nose/dog_001.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8900, false, 'left',  'v1.0.0', true, '2026-05-09 10:00:00'),
('v-00016-0016-0016-000000000016', 'a-00005-0005-0005-000000000005', 0xf806bc69b5a623b999851e29a746f4585c3964f6bb587018118f5b1c9bf0fa4561befa07cf4ca6b1bf7326e910ecb3b5a80b1233fb621792bc582e6ef634a3ff6013f46fbfd46cfd084362b58ea94a0afabb5434e3484d5e9d2f2248cf9cf3f3e499a562b73e6f08ee33f276a18e2621944542745a8ce1890a305629a4ec8dfa, 128, '/static/uploads/nose/dog_002.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8700, false, 'right', 'v1.0.0', true, '2026-05-10 09:00:00');

-- 狗F: 哈士奇
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00017-0017-0017-000000000017', 'a-00006-0006-0006-000000000006', 0x11e5be9043ac3d6daacf609b7d1724979a460a8e9230fe18311e2e9eb881cd574bcbb17f9a938d2abf3b6cdb64b9fb49f503825c628680988478cc1eaf7f785edc89625525150ee4d441e8807ac868869f91186ed9a0fdd2f6a43db123bf12a2e06d174d675b386aed717c1540d808e652a4f219a6fcd5f7566347b50aaa9a17, 128, '/static/uploads/nose/dog_001.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9300, true,  'front', 'v1.0.0', true, '2026-05-12 15:00:00'),
('v-00018-0018-0018-000000000018', 'a-00006-0006-0006-000000000006', 0x32982186974e21e5ec5d1b6b13d0eda385b0f1bde2e0c7b2561e2c58123e62059ad563e9c2855d368ecc37cbb1d59604dc1b65e6fad8f600948348d2858c208732cf47a834570027ba7f961781ffa6bc54dbcf89e819af61dd59a03c321198ac6f8360663daaee7a0d282811c7ad368fa587779860cc8d647bfc5edbfe8c937b, 128, '/static/uploads/nose/dog_002.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8800, false, 'left',  'v1.0.0', true, '2026-05-12 16:00:00'),
('v-00019-0019-0019-000000000019', 'a-00006-0006-0006-000000000006', 0x21639e3a21dcf366321b62119b059ea29474868468e0f45bc46d726924884e99cc8299e5ed8e960a563a52c7bafee3d9e4489fdb93d3c3c8da39f944c414c8c7710f1929bc9cfb8b85c7aebe9711d18bbba8467e6b101f69b771936d90e0f111619093b213f9049f767ec754442604ef546225fe0a5e4022c81f16d41386d0cd, 128, '/static/uploads/nose/dog_003.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8600, false, 'right', 'v1.0.0', true, '2026-05-13 10:00:00');

-- 狗G: 泰迪
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00020-0020-0020-000000000020', 'a-00007-0007-0007-000000000007', 0x91e993f566a4b2b40f13477b8a645b1d45514cd9cc9e688a958548b0404955ff4c296dfc32c7f39044f58195c844a4548cbff6ae155065908b7b681e3d7ae848701db0b82ba38fe32790170244a1cba9c4d53337008d7eed46d33f7bd14e0f1c05c9ed4a4ac2bc9b3a6f6591931d1c9dcdf5fd59cc012ad7233165424c414cec, 128, '/static/uploads/nose/dog_002.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9250, true,  'front', 'v1.0.0', true, '2026-05-11 11:00:00'),
('v-00021-0021-0021-000000000021', 'a-00007-0007-0007-000000000007', 0x2c37b1d43e34eedc943c118bf3ca4eb0654dc1a831664e3ecde118bb0a98a7c1d5c2cca3d8e0227cd709d09466eacbbdc835b5f1c4f9f5c07d017de632b900b5207c8a5a18402b5acc987e5505ed73603ff208588e6738c8c75f0aee5e7a17d85f0ca66143bfd824b636a1924d6e06fd305a53584708b81d1e2edb48898e79e2, 128, '/static/uploads/nose/dog_003.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8700, false, 'left',  'v1.0.0', true, '2026-05-11 12:00:00'),
('v-00022-0022-0022-000000000022', 'a-00007-0007-0007-000000000007', 0x356ac4bf809d6a2135730ce2d0f981d629e80c437e187b4072662e09249e8330922da9aa0b648881c446ac1465111b3da420a90a849f573edf4f99871a94f62a7e40f2027b646a8939f17e2013f1b76c737173db74b22a5885d390c73cff7fa192e88b2e3f3d4fd8fce9a41aa3a42ef0271d254eaa613cd51e3690a35611f811, 128, '/static/uploads/nose/dog_004.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8500, false, 'right', 'v1.0.0', true, '2026-05-12 10:00:00');

-- 狗H: 边牧 (claimed)
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00023-0023-0023-000000000023', 'a-00008-0008-0008-000000000008', 0xdc60b0ff7099e8408654cf5778d575a2087d1ae1aa9451b04ab2b79de81a4d56bd70319d130e40f6e4685d0e21a1cf8a03ed707f6f91990f492bc12191990e0ab64ea1ce3297e73aa8e79e59e6cc0b7b52727f7c3d7afb47112fb6abf66558c75b28dd0004e68f28f9c6709f22779f79a2dc9e7c33b0fad1a86a556bcb2ad69a, 128, '/static/uploads/nose/dog_003.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9450, true,  'front', 'v1.0.0', true, '2026-05-03 11:00:00'),
('v-00024-0024-0024-000000000024', 'a-00008-0008-0008-000000000008', 0x5505fd9ec4e3851dfcac4aca11ac3a7a9d80613cc1e2bb2daac4035495febe4e03b50ec002d62dcabb9ef7c39e68afe0a8681d3b2651897a2617fcad67737bca1849b377271b709e59d644714dfc5af5fa6e9d8f75a9851b469eaf9cbb3688e62f468b884157a6e0efde8d31ba1861348f8be9b8cfa5b5e82e343438c0389432, 128, '/static/uploads/nose/dog_004.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9000, false, 'left',  'v1.0.0', true, '2026-05-03 12:00:00'),
('v-00025-0025-0025-000000000025', 'a-00008-0008-0008-000000000008', 0xcec91f36cb4254d55da8227051d331de92568037d2fcf87a22820aeb1b2553a312e5b31f16bf76b9798bb6b012887e270fe01c5ed3e96f348fb3a50775e94eefafbb2d80a7c333b701980bf296955450a9e91cfd42e67ed92175e86267eca1b75719d42285bad5941597560f479d25d6fe479bba032f8aa8b1e5dc46f71aea33, 128, '/static/uploads/nose/dog_005.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8800, false, 'right', 'v1.0.0', true, '2026-05-05 10:00:00');

-- 狗I: 柯基 (found)
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00026-0026-0026-000000000026', 'a-00009-0009-0009-000000000009', 0xa8ae215fd57940966a8c1465117f8194b53adbdf3a0d789c4b29d60214db20d2fef8867c2eb7897b9e1515eca306111a080215b80408f9e37232617ead59d345d9ee1071e5f98d22b1da1ba282ef8bd51fa1e12318be47ba841dc2fafd9fb2a4e24eeb8cb355fcb1ce97e791c809440d584de24cae642d0c7d740814adf47996, 128, '/static/uploads/nose/dog_004.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.9100, true,  'front', 'v1.0.0', true, '2026-05-07 10:00:00'),
('v-00027-0027-0027-000000000027', 'a-00009-0009-0009-000000000009', 0x954bee9055e0e8e0b38d4372cbe049373df40c78137927fb281e95906a96ea9983b7f116a96bb3c584d441523cb43990d744d663cde7eb53748da42f304f978d53e7ab950bfb1cb4895a31307561acd1247b49ec6cbf3f6b618fe0d113b8976da338cc4361be6673355f4eddf643beaed113aeec12b7b92b9f4a514d2be8cd96, 128, '/static/uploads/nose/dog_005.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8600, false, 'left',  'v1.0.0', true, '2026-05-07 11:00:00'),
('v-00028-0028-0028-000000000028', 'a-00009-0009-0009-000000000009', 0x258448593004a92d466a0e906e4dbf16e03d6416c5365fcfb71b1e575ead9d2a27a5d23d3f8ba145ef2199ba700886fe51c710db51eefde1d26e70d4c8e3f7167ae02027c7421c80bcb83f2c12e21ce8772d3c15fc604aa29413c8975de94dd7df22eabd5dae5f64bdebb7381efbecb69c6a892cd8b11a489e9de7daabda3902, 128, '/static/uploads/nose/dog_001.jpg', '{"landmarks":[],"bbox":[100,100,200,200]}', 0.8400, false, 'right', 'v1.0.0', false,'2026-05-08 09:00:00');

-- 猫J: 咪咪
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00029-0029-0029-000000000029', 'a-00010-0010-0010-000000000010', 0xdb169de2cbc4c8fdafcb7f1905d350deccded3ffcf1cc2df90d082371c62324a6ee8e88527896646df5d62978a0122dd825226937a7eb4c86fc23e210694bc4fb84eb7d02b85bdaa2fcf176523eb127c1abb2f012759d9e1508cf9ac6c4d856123326b3c1b03f7b63ebbf6c60cb8a359f457d4b0d8f819f946af1c93b8f74be9, 128, '/static/uploads/nose/cat_001.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.9350, true,  'front', 'v1.0.0', true, '2026-05-06 11:00:00'),
('v-00030-0030-0030-000000000030', 'a-00010-0010-0010-000000000010', 0xb98f8338a45b81f9c1fde46b3c73c06a22a776c87d6a9da001395fe08299bd269696638810447da242b5ea0f085acb1c7897a29073de4da36dceeb3ceaafe5e3de324500c825cc644667b64ad7915431068f09ee97e29106101a4eb5865a52bf48e22e4d6d1ce43c49b0871f1b2edda57d3c5dee382872688082dabc0b8aec18, 128, '/static/uploads/nose/cat_002.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.8900, false, 'left',  'v1.0.0', true, '2026-05-06 12:00:00'),
('v-00031-0031-0031-000000000031', 'a-00010-0010-0010-000000000010', 0x83aefd228378a978694d35401bc1d97193789f26ab03346f11772b48828716c44200e0b71d320c3456b7736a6aa2d56c03df15a31c690f68777fa754478757f53ea8dd1a459c39c6677fc8acf4d7af79f40c154da5815e791c14d512c3c8ef22c333defa7a53f3fc2007fd84b61d6aef17a5c2a01acddbfe6d303a480a7cd25d, 128, '/static/uploads/nose/cat_003.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.8700, false, 'right', 'v1.0.0', true, '2026-05-08 10:00:00');

-- 猫K: 团子
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00032-0032-0032-000000000032', 'a-00011-0011-0011-000000000011', 0x0c68806a36d8cb9f85997ce5e77430df2ab0ac11c2e34b96fd6aa17725bd35128da688ccc2a8ad8ac426704492099fdf9617048e26a4ff58c63ba90854fd9a2b664652861e7523c0aa95ffb33a04ae3261be32eb47c51ceb598cfc19f73c3726af967a1b203cab1b485ae1bde780a4759fe27ef1c53897ad02f1a16443233121, 128, '/static/uploads/nose/cat_002.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.9050, true,  'front', 'v1.0.0', true, '2026-05-10 10:00:00'),
('v-00033-0033-0033-000000000033', 'a-00011-0011-0011-000000000011', 0x2565a895923a463a0e7baf41228dbeab1657893929fc6556499554e8fa0702d258c42b894ccc906cd8796091efc173de784197960859f409f4294b7ba7dc1e73f27d9e575812a386b57f070badb6e3917875013c057356c4de9b8194441c67cc632cf78e3826763919da502524b55c512c0d9571f1f346105f2299f2c8b15100, 128, '/static/uploads/nose/cat_003.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.8600, false, 'left',  'v1.0.0', true, '2026-05-10 11:00:00'),
('v-00034-0034-0034-000000000034', 'a-00011-0011-0011-000000000011', 0x135662c9faed02bebc449391ab81f001f99f4c720ae955b89ddad74c83977d93bec157e411e2918573c25aa9aa6f35366b59c8c2e10b2aa511b82525187e30178f97fd6bbaa9e3b88cd3a3e87aa644de2b837296494fdc09f8102a17033a1b6fdd5c419695642939083f7649f8cba4fd4fd975c413f1df72f7d0704ac15648f0, 128, '/static/uploads/nose/cat_001.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.8300, false, 'right', 'v1.0.0', false,'2026-05-11 10:00:00');

-- 猫L: 雪球
INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) VALUES
('v-00035-0035-0035-000000000035', 'a-00012-0012-0012-000000000012', 0xcd71d4c5bcf4a9f0b1693841e6bd291d374f6a37642bd3b06201844c55a8020417e9c731ea0bbb2726e2f606bccce2050b4d03976edce548dd90b583e54faae8b04d84db739736b48cb2cf0c20f09c5f30bff5ee3d76e1799a9ca8bc756e36bdd16d7c6b5fb888649d4ceeca0da97cd5941762d9ad0ca7c82ae1b9a5e6fc4e48, 128, '/static/uploads/nose/cat_003.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.9200, true,  'front', 'v1.0.0', true, '2026-05-05 11:00:00'),
('v-00036-0036-0036-000000000036', 'a-00012-0012-0012-000000000012', 0xf378681988083f1365353dcb63861a0de1141f375302589523fbefff926078915231a754a1733c326ea7a54c284c6effe635f05d71c1be1e91630d115faf43221405fad84db0288416180bdaf7b0921a256d8d9794c34fdc57c0447a2da4afa682e5fef59ccb1946632bd8ede85ec698af02432f575aaca852476cfe55e4a76c, 128, '/static/uploads/nose/cat_001.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.8800, false, 'left',  'v1.0.0', true, '2026-05-05 12:00:00'),
('v-00037-0037-0037-000000000037', 'a-00012-0012-0012-000000000012', 0x03541a8d600965b9e44fce48f865682041629dfaf5a4f21178680bbd02802f61e15e87118dd06312d90d0f317e9a5d75d135c0222fbfad7660c1bf5b6b82887638fea7c7d43d936c7e2b217eefd5698f6058927e2fce3eb4454511642527751774d15de49895205b9bd4fa57b56c8d6248c7cab608a0b9819de5318f5e463fc5, 128, '/static/uploads/nose/cat_002.jpg', '{"landmarks":[],"bbox":[80,80,160,160]}', 0.8600, false, 'right', 'v1.0.0', true, '2026-05-07 10:00:00');

-- 更新各动物的主鼻纹ID
UPDATE animals SET primary_nose_id='v-00001-0001-0001-000000000001' WHERE animal_id='a-00001-0001-0001-000000000001';
UPDATE animals SET primary_nose_id='v-00005-0005-0005-000000000005' WHERE animal_id='a-00002-0002-0002-000000000002';
UPDATE animals SET primary_nose_id='v-00008-0008-0008-000000000008' WHERE animal_id='a-00003-0003-0003-000000000003';
UPDATE animals SET primary_nose_id='v-00011-0011-0011-000000000011' WHERE animal_id='a-00004-0004-0004-000000000004';
UPDATE animals SET primary_nose_id='v-00014-0014-0014-000000000014' WHERE animal_id='a-00005-0005-0005-000000000005';
UPDATE animals SET primary_nose_id='v-00017-0017-0017-000000000017' WHERE animal_id='a-00006-0006-0006-000000000006';
UPDATE animals SET primary_nose_id='v-00020-0020-0020-000000000020' WHERE animal_id='a-00007-0007-0007-000000000007';
UPDATE animals SET primary_nose_id='v-00023-0023-0023-000000000023' WHERE animal_id='a-00008-0008-0008-000000000008';
UPDATE animals SET primary_nose_id='v-00026-0026-0026-000000000026' WHERE animal_id='a-00009-0009-0009-000000000009';
UPDATE animals SET primary_nose_id='v-00029-0029-0029-000000000029' WHERE animal_id='a-00010-0010-0010-000000000010';
UPDATE animals SET primary_nose_id='v-00032-0032-0032-000000000032' WHERE animal_id='a-00011-0011-0011-000000000011';
UPDATE animals SET primary_nose_id='v-00035-0035-0035-000000000035' WHERE animal_id='a-00012-0012-0012-000000000012';

-- 5. 创建救助事件
INSERT INTO rescue_events (event_id, animal_id, event_type, reporter_id, station_id, occurred_at, location_lat, location_lng, address, photos, nose_photo_url, description, action_taken, is_duplicate, duplicate_of, fusion_score, status, created_at) VALUES

-- 有明确动物的事件
('e-00001-0001-0001-000000000001', 'a-00001-0001-0001-000000000001', 'report', 'u-user1-0001-0000-0000-000000000002', NULL, '2026-05-10 10:00:00', 31.2304, 121.4737, '上海市静安区南京西路1788号',   '[]', NULL, '在小区内发现一只金毛犬，疑似走失，佩戴蓝色项圈，尾巴尖有白毛，很亲人', '已确认为走失动物，建档处理', false, NULL, 0.9234, 'confirmed',  '2026-05-10 10:30:00'),
('e-00002-0002-0002-000000000002', 'a-00002-0002-0002-000000000002', 'report', 'u-user2-0001-0000-0000-000000000003', NULL, '2026-05-11 11:00:00', 31.2404, 121.4837, '上海市静安区北京西路100号',    '[]', NULL, '路边发现一只棕色土狗，很温顺，左耳有缺口，旁边有狗粮，疑似走失',     '与豆豆鼻纹比对，排除重复，标记为新走失', true, NULL, 0.8512, 'duplicated', '2026-05-11 11:30:00'),
('e-00003-0003-0003-000000000003', 'a-00003-0003-0003-000000000003', 'report', 'u-user3-0001-0000-0000-000000000004', NULL, '2026-05-12 12:00:00', 31.2504, 121.4937, '上海市静安区华山路88号',        '[]', NULL, '小区门口发现一只萨摩耶，很干净，走失时穿红色背心，看起来很着急',     '待AI比对确认', false, NULL, 0.9050, 'pending',    '2026-05-12 12:30:00'),
('e-00004-0004-0004-000000000004', 'a-00004-0004-0004-000000000004', 'report', 'u-user4-0001-0000-0000-000000000005', NULL, '2026-05-13 09:00:00', 31.2604, 121.5037, '上海市浦东新区世纪大道200号',   '[]', NULL, '发现一只拉布拉多右后腿受伤，行走缓慢，趴在路边不动，急需救助',       '已送往附近宠物医院治疗', false, NULL, 0.9180, 'confirmed',  '2026-05-13 09:30:00'),
('e-00005-0005-0005-000000000005', 'a-00005-0005-0005-000000000005', 'report', 'u-user5-0001-0000-0000-000000000006', NULL, '2026-05-10 18:00:00', 31.2104, 121.4637, '上海市徐汇区淮海中路999号',    '[]', NULL, '发现一只黑色柴犬，棕色围脖，很警觉，不让人靠近，在小区内徘徊',       '安排人员蹲守', false, NULL, 0.8900, 'pending',    '2026-05-10 18:30:00'),

-- 捡到事件
('e-00006-0006-0006-000000000006', 'a-00008-0008-0008-000000000008', 'report', 'u-user6-0001-0000-0000-000000000007', NULL, '2026-05-05 14:00:00', 31.2204, 121.4537, '上海市长宁区延安西路100号',   '[]', NULL, '在小区内捡到一只边牧，黑色白色，已联系主人认领',                         '已认领，动物状态更新为claimed', false, NULL, 0.9400, 'resolved',   '2026-05-05 14:30:00'),
('e-00007-0007-0007-000000000007', 'a-00009-0009-0009-000000000009', 'report', 'u-user7-0001-0000-0000-000000000008', NULL, '2026-05-08 11:00:00', 31.2704, 121.5137, '上海市闵行区莘庄镇莘建路88号', '[]', NULL, '路边发现一只柯基，走失小狗，在路边徘徊，疑似与主人走散',                 '暂无主人认领，等待中', false, NULL, 0.8900, 'pending',    '2026-05-08 11:30:00'),

-- 猫
('e-00008-0008-0008-000000000008', 'a-00010-0010-0010-000000000010', 'report', 'u-user1-0001-0000-0000-000000000002', NULL, '2026-05-08 16:00:00', 31.2304, 121.4637, '上海市静安区新闸路200号',     '[]', NULL, '小区内发现一只橘色狸花猫，胖胖的，佩戴粉色项圈，在垃圾桶旁边找吃的',  '已建档，等待主人认领', false, NULL, 0.9200, 'confirmed',  '2026-05-08 16:30:00'),
('e-00009-0009-0009-000000000009', 'a-00011-0011-0011-000000000011', 'report', 'u-user2-0001-0000-0000-000000000003', NULL, '2026-05-11 14:00:00', 31.2404, 121.4737, '上海市静安区昌平路50号',      '[]', NULL, '发现一只英短蓝猫，眼睛有分泌物，精神不佳，疑似生病，需送医治疗',       '已送医，待康复后寻主', false, NULL, 0.8800, 'pending',    '2026-05-11 14:30:00'),
('e-00010-0010-0010-000000000010', 'a-00012-0012-0012-000000000012', 'report', 'u-user3-0001-0000-0000-000000000004', NULL, '2026-05-07 13:00:00', 31.2504, 121.4837, '上海市静安区江宁路88号',      '[]', NULL, '小区内发现一只纯白波斯猫，很温顺，在长椅上晒太阳，疑似走失',             '暂无失主报案，等待中', false, NULL, 0.9100, 'pending',    '2026-05-07 13:30:00'),

-- 无主事件
('e-00011-0011-0011-000000000011', NULL, 'report', 'u-user4-0001-0000-0000-000000000005', NULL, '2026-05-13 16:00:00', 31.2804, 121.5237, '上海市浦东新区张江镇碧波路',   '[]', NULL, '路边发现一只哈士奇，蓝色眼睛，胖胖的，很亲人，在路边找水喝',             '正在寻找主人', false, NULL, NULL, 'pending',    '2026-05-13 16:30:00'),
('e-00012-0012-0012-000000000012', NULL, 'report', 'u-user5-0001-0000-0000-000000000006', NULL, '2026-05-12 15:00:00', 31.2304, 121.4837, '上海市静安区陕西北路100号',   '[]', NULL, '小区内发现一只泰迪，棕色，剪了造型，很干净，疑似走失',                  '暂无失主报案', false, NULL, NULL, 'pending',    '2026-05-12 15:30:00'),
('e-00013-0013-0013-000000000013', NULL, 'rescue', 'u-org1--0001-0000-0000-000000000009', NULL, '2026-05-12 10:00:00', 31.3000, 121.5500, '上海市闵行区救助站',           '[]', NULL, '救助站收容一只流浪金毛，身体健康，性格温顺，待领养',                     '收容观察中，待领养', false, NULL, NULL, 'pending',    '2026-05-12 10:30:00'),
('e-00014-0014-0014-000000000014', NULL, 'medical','u-org2--0001-0000-0000-000000000010', NULL, '2026-05-13 08:00:00', 31.2500, 121.5100, '北京朝阳区流浪动物保护中心',   '[]', NULL, '收容一只受伤流浪猫，左前腿骨折，已送医治疗，急需手术费',                   '已送医治疗中', false, NULL, NULL, 'pending',    '2026-05-13 08:30:00'),
('e-00015-0015-0015-000000000015', NULL, 'report', 'u-user6-0001-0000-0000-000000000007', NULL, '2026-05-11 14:00:00', 31.2604, 121.4937, '上海市静安区静安公园',        '[]', NULL, '在公园发现一只松狮，棕色毛发打结，很脏，疑似被遗弃',                      '已收容，待清洁后评估', false, NULL, NULL, 'pending',    '2026-05-11 14:30:00');

-- 6. 创建认领记录
INSERT INTO claims (claim_id, animal_id, claimer_id, event_id, claimed_at, status, notes, proof_photos, approved_by, approved_at, created_at) VALUES

-- 已通过
('c-00001-0001-0001-000000000001', 'a-00001-0001-0001-000000000001', 'u-user1-0001-0000-0000-000000000002', 'e-00001-0001-0001-000000000001', '2026-05-10 14:00:00', 'approved', '这是我家走失的豆豆，三个月前从家里跑出去，佩戴蓝色项圈，尾巴尖有白毛，请好心人归还，必有重谢！', '[]', 'u-admin-0001-0000-0000-000000000001', '2026-05-10 16:00:00', '2026-05-10 14:00:00'),
('c-00002-0002-0002-000000000002', 'a-00008-0008-0008-000000000008', 'u-user6-0001-0000-0000-000000000007', 'e-00006-0006-0006-000000000006', '2026-05-05 15:00:00', 'approved', '花花是我家的边牧，走失了3天，感谢好心人收留！', '[]', 'u-admin-0001-0000-0000-000000000001', '2026-05-05 16:00:00', '2026-05-05 15:00:00'),

-- 待审批
('c-00003-0003-0003-000000000003', 'a-00003-0003-0003-000000000003', 'u-user3-0001-0000-0000-000000000004', 'e-00003-0003-0003-000000000003', '2026-05-12 14:00:00', 'pending', '小白是我家走失的萨摩耶，穿红色背心，走失2天了，非常着急，拜托好心人收留！', '[]', NULL, NULL, '2026-05-12 14:00:00'),
('c-00004-0004-0004-000000000004', 'a-00010-0010-0010-000000000010', 'u-user1-0001-0000-0000-000000000002', 'e-00008-0008-0008-000000000008', '2026-05-08 18:00:00', 'pending', '咪咪是我家的橘猫，胖胖的，佩戴粉色项圈，走失一周了，全家都很着急！', '[]', NULL, NULL, '2026-05-08 18:00:00'),
('c-00005-0005-0005-000000000005', 'a-00009-0009-0009-000000000009', 'u-user7-0001-0000-0000-000000000008', 'e-00007-0007-0007-000000000007', '2026-05-08 13:00:00', 'pending', '来福是我家的小柯基，走失了，昨天还在附近看到过，拜托大家帮忙留意！', '[]', NULL, NULL, '2026-05-08 13:00:00'),
('c-00006-0006-0006-000000000006', 'a-00012-0012-0012-000000000012', 'u-user3-0001-0000-0000-000000000004', NULL, '2026-05-08 10:00:00', 'pending', '雪球是我家的波斯猫，纯白，走失好几天了，麻烦帮忙留意！', '[]', NULL, NULL, '2026-05-08 10:00:00'),

-- 被驳回
('c-00007-0007-0007-000000000007', 'a-00002-0002-0002-000000000002', 'u-user2-0001-0000-0000-000000000003', 'e-00002-0002-0002-000000000002', '2026-05-11 13:00:00', 'rejected', '这只土狗看起来像我家的，但项圈颜色不对，也没有左耳缺口，不是我的狗', '[]', 'u-admin-0001-0000-0000-000000000001', '2026-05-11 15:00:00', '2026-05-11 13:00:00'),
('c-00008-0008-0008-000000000008', 'a-00005-0005-0005-000000000005', 'u-user5-0001-0000-0000-000000000006', 'e-00005-0005-0005-000000000005', '2026-05-10 20:00:00', 'rejected', '我家的柴犬是黑色的，但这只黑色柴犬的围脖是棕色的，应该不是同一只', '[]', 'u-admin-0001-0000-0000-000000000001', '2026-05-10 21:00:00', '2026-05-10 20:00:00');

-- 7. 统计输出
SELECT 'users' as tbl, COUNT(*) as cnt FROM users
UNION ALL SELECT 'animals', COUNT(*) FROM animals
UNION ALL SELECT 'nose_features', COUNT(*) FROM nose_features
UNION ALL SELECT 'rescue_events', COUNT(*) FROM rescue_events
UNION ALL SELECT 'claims', COUNT(*) FROM claims;
