// -*- coding: utf-8 -*-
/**
 * 【2026-07-10 阶段 E P0】EventRecallService source 字段标注测试
 *
 * 覆盖:
 *   1) 同 animal 召回返回 source='same'
 *   2) 全局兜底召回返回 source='fallback'
 *   3) 合并去重: 同 animal 优先, fallback 仅作为补充
 *   4) source 字段在所有 EventCandidate 上都存在
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventRecallService } from '../event-recall.service';
import { RescueEvent, EventStatus, EventType, EventSource } from '../../events/entities/event.entity';
import { Animal } from '../../animals/entities/animal.entity';

function makeEvent(overrides: Partial<RescueEvent> = {}): RescueEvent {
  return {
    event_id: 'e-1',
    animal_id: 'a-1',
    event_type: EventType.REPORT,
    source: EventSource.REPORT,
    reporter_id: 'u-1',
    occurred_at: new Date('2026-07-09T08:00:00Z'),
    location_lat: 0,
    location_lng: 0,
    status: EventStatus.PENDING,
    is_duplicate: false,
    candidates: null,
    body_colors: null,
    ...overrides,
  } as RescueEvent;
}

describe('EventRecallService.source (阶段 E P0)', () => {
  let findMock: jest.Mock;
  let animalFindMock: jest.Mock;
  let qbMock: any;
  let service: EventRecallService;

  beforeEach(async () => {
    findMock = jest.fn();
    animalFindMock = jest.fn().mockResolvedValue({ location_lat: 30.5, location_lng: 114.3 });
    qbMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const eventRepo = {
      find: findMock,
      createQueryBuilder: jest.fn(() => qbMock),
    };
    const animalRepo = { findOne: animalFindMock };
    const mod = await Test.createTestingModule({
      providers: [
        EventRecallService,
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
      ],
    }).compile();
    service = mod.get(EventRecallService);
  });

  it('同 animal 召回返回 source="same"', async () => {
    const sameEvents = [
      makeEvent({ event_id: 'e-same-1', animal_id: 'a-1' }),
      makeEvent({ event_id: 'e-same-2', animal_id: 'a-1' }),
    ];
    findMock.mockResolvedValue(sameEvents);
    qbMock.getMany.mockResolvedValue([]);

    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.length).toBe(2);
    expect(out.every((c) => c.source === 'same')).toBe(true);
  });

  it('全局兜底召回返回 source="fallback"', async () => {
    findMock.mockResolvedValue([]); // 同 animal 无结果
    qbMock.getMany.mockResolvedValue([
      makeEvent({ event_id: 'e-fb-1', animal_id: 'a-2' }),
      makeEvent({ event_id: 'e-fb-2', animal_id: 'a-3' }),
    ]);

    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.length).toBe(2);
    expect(out.every((c) => c.source === 'fallback')).toBe(true);
  });

  it('同 animal 事件优先, fallback 仅补全 (同 animal 已有 e-1, fallback 也有 e-1 时去重为 same)', async () => {
    const sameEvents = [
      makeEvent({ event_id: 'e-1', animal_id: 'a-1' }),
    ];
    findMock.mockResolvedValue(sameEvents);
    qbMock.getMany.mockResolvedValue([
      makeEvent({ event_id: 'e-1', animal_id: 'a-1' }), // 重复
      makeEvent({ event_id: 'e-2', animal_id: 'a-2' }), // 新增
    ]);

    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.length).toBe(2);
    const e1 = out.find((c) => c.event_id === 'e-1');
    const e2 = out.find((c) => c.event_id === 'e-2');
    expect(e1!.source).toBe('same'); // 同 animal 优先
    expect(e2!.source).toBe('fallback'); // fallback 补充
  });

  it('所有 EventCandidate 都带 source 字段 (类型守卫)', async () => {
    findMock.mockResolvedValue([makeEvent({ event_id: 'e-1' })]);
    qbMock.getMany.mockResolvedValue([makeEvent({ event_id: 'e-2', animal_id: 'a-2' })]);

    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    for (const c of out) {
      expect(['same', 'fallback']).toContain(c.source);
    }
  });

  it('animalId 为空时, fallback 仍可召回', async () => {
    findMock.mockResolvedValue([]);
    qbMock.getMany.mockResolvedValue([
      makeEvent({ event_id: 'e-fb-1', animal_id: 'a-2' }),
    ]);

    const out = await service.recall('', new Date('2026-07-09T10:00:00Z'));
    expect(out.length).toBe(1);
    expect(out[0].source).toBe('fallback');
  });
});
