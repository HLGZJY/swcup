SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM nose_features WHERE nose_photo_url LIKE '/static/uploads/nose/pre%';
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '68eca223-7d11-4174-bfc6-2d0450d16d16', 'lost', 'dog', '金毛', '金色', 'male',
            'adult', 'healthy', 1,
            NOW(), NOW(),
            31.228, 121.447,
            '上海市静安区南京西路 1788 号(静安公园)',
            '佩戴蓝色项圈,尾巴尖有白毛,亲人',
            '["走失","佩戴项圈","亲人"]',
            '["/static/uploads/animals/A1.jpg"]',
            'a2742401-b7ef-47db-b857-832c5db4632c',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            'abcbc676-83cc-4ed1-ae09-718dd950df8a', 'lost', 'dog', '金毛', '金色', 'male',
            'adult', 'healthy', 1,
            NOW(), NOW(),
            31.2285, 121.4475,
            '上海市静安区南京西路 1788 号(静安公园)',
            '同豆豆,二次发现(80m 内)',
            '["走失","二次发现"]',
            '["/static/uploads/animals/A2.jpg"]',
            NULL,
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '24ca0eae-ef75-4d7a-aed3-db91016277ff', 'lost', 'dog', '拉布拉多', '黄色', 'male',
            'adult', 'injured', 1,
            NOW(), NOW(),
            31.255, 121.595,
            '上海市浦东新区金桥路 200 号',
            '右后腿受伤,行走缓慢,急需救助',
            '["走失","受伤","急需救助"]',
            '["/static/uploads/animals/A3.jpg"]',
            'f5374e2c-a710-488c-bc03-de6858d4d257',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '632319a1-eb8c-4a30-861e-c12338bd3c19', 'found', 'dog', '萨摩耶', '白色', 'male',
            'puppy', 'healthy', 1,
            NOW(), NOW(),
            31.265, 121.498,
            '上海市虹口区四川北路 1888 号',
            '路边徘徊,穿红色背心,疑似走失',
            '["捡到","待认领"]',
            '["/static/uploads/animals/A4.jpg"]',
            '5384daf1-076f-4bc4-b48f-6f02f476e705',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '42e944f7-c4a9-4b10-abf2-61ad1ab76e4b', 'lost', 'dog', '土狗', '棕色', 'female',
            'adult', 'healthy', 0,
            NOW(), NOW(),
            31.195, 121.435,
            '上海市徐汇区衡山路 999 号',
            '左耳有缺口,温顺,旁边有狗粮',
            '["走失","温顺"]',
            '["/static/uploads/animals/A5.jpg"]',
            '6c82be04-1c80-4704-9adc-8cec73838076',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '615a6163-9057-48c3-8a27-9d31f849acad', 'lost', 'dog', '土狗', '棕色', 'female',
            'adult', 'healthy', 0,
            NOW(), NOW(),
            31.1958, 121.4358,
            '上海市徐汇区衡山路 999 号',
            '同旺财,二次发现(100m 内)',
            '["走失","二次发现"]',
            '["/static/uploads/animals/A6.jpg"]',
            NULL,
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '8952958d-e1b9-4593-8c49-3a6c3ec20d85', 'lost', 'dog', '边牧', '黑白', 'female',
            'adult', 'healthy', 1,
            NOW(), NOW(),
            31.22, 121.418,
            '上海市长宁区中山公园',
            '走失 3 天,已联系主人认领',
            '["走失","已联系"]',
            '["/static/uploads/animals/A7.jpg"]',
            '6dc0b6ec-1663-4a60-9a1d-4e774bc864c0',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            'c647f260-4442-4431-ac34-f03ba23cd53f', 'found', 'dog', '柴犬', '黑色', 'female',
            'adult', 'healthy', 0,
            NOW(), NOW(),
            31.11, 121.382,
            '上海市闵行区莘庄镇莘建路 88 号',
            '棕色围脖,警觉,不让人靠近,需专业救助',
            '["捡到","警觉","需救助"]',
            '["/static/uploads/animals/A8.jpg"]',
            'f15d72d5-3889-413a-ba44-f7762f9f8dc5',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '8718963a-f153-410c-a53f-ee0c9a7aff80', 'lost', 'cat', '中华田园猫', '橘色', 'male',
            'adult', 'healthy', 0,
            NOW(), NOW(),
            31.228, 121.447,
            '上海市静安区南京西路 1788 号(静安公园)',
            '橘色狸花,胖胖的,佩戴粉色项圈',
            '["走失","佩戴项圈"]',
            '["/static/uploads/animals/A9.png"]',
            '1c8905a5-bee5-478e-ac41-1706c6a1c815',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '4b279fa1-edca-4c91-bb29-79d49ffdd621', 'claimed', 'cat', '英短', '蓝灰色', 'female',
            'adult', 'ill', 1,
            NOW(), NOW(),
            31.25, 121.395,
            '上海市普陀区长寿路 200 号',
            '英短蓝猫,眼睛有分泌物,需治疗',
            '["走失","生病"]',
            '["/static/uploads/animals/A10.jpg"]',
            '76a55bb4-bbef-466b-b43f-57f714ed8d3f',
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );
SET FOREIGN_KEY_CHECKS = 1;
