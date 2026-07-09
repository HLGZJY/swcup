// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 C】EventRecallService 单元测试
 *
 * 覆盖:
 *   1) 同 animal 5 条主路
 *   2) 30 天兜底全局扫描
 *   3) 主路 + 兜底合并去重
 *   4) 过滤 REJECTED/DUPLICATED
 *   5) 时间窗 cutoff 正确 (cutoff 之外的不取)
 *   6) 兜底查询失败 → 主路不受影响
 *   7) 排序: occurred_at DESC
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventRecallService } from '../event-recall.service';
import { RescueEvent, EventStatus, EventType, EventSource } from '../../events/entities/event.entity';

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

describe('EventRecallService (阶段 C)', () => {
  let findMock: jest.Mock;
  let qbMock: any;
  let service: EventRecallService;

  beforeEach(async () => {
    findMock = jest.fn();
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
    const mod = await Test.createTestingModule({
      providers: [
        EventRecallService,
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
      ],
    }).compile();
    service = mod.get(EventRecallService);
  });

  it('Step 1: 同 animal 取最近 5 条', async () => {
    const events = [
      makeEvent({ event_id: 'e-1', occurred_at: new Date('2026-07-09T08:00:00Z') }),
      makeEvent({ event_id: 'e-2', occurred_at: new Date('2026-07-08T08:00:00Z') }),
    ];
    findMock.mockResolvedValue(events);
    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { animal_id: 'a-1' }, take: 5 }),
    );
    expect(out.length).toBe(2);
  });

  it('Step 2: 30 天兜底触发 createQueryBuilder', async () => {
    findMock.mockResolvedValue([]);
    const cutoff = new Date('2026-06-09T10:00:00Z'); // 30 天前
    await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(qbMock.where).toHaveBeenCalledWith(
      'e.occurred_at >= :cutoff',
      expect.objectContaining({ cutoff: expect.any(Date) }),
    );
    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'e.status NOT IN (:...bad)',
      expect.objectContaining({ bad: [EventStatus.REJECTED, EventStatus.DUPLICATED] }),
    );
    expect(qbMock.limit).toHaveBeenCalledWith(10);
  });

  it('合并去重: Step1 + Step2 同 event_id 出现 2 次 → 1 条', async () => {
    findMock.mockResolvedValue([
      makeEvent({ event_id: 'shared', animal_id: 'a-1' }),
      makeEvent({ event_id: 'main-only', animal_id: 'a-1' }),
    ]);
    qbMock.getMany.mockResolvedValue([
      makeEvent({ event_id: 'shared', animal_id: 'a-2' }),
      makeEvent({ event_id: 'fallback-only', animal_id: 'a-3' }),
    ]);
    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.length).toBe(3);
    const ids = out.map((e) => e.event_id);
    expect(ids.filter((id) => id === 'shared').length).toBe(1);
  });

  it('过滤 REJECTED/DUPLICATED 状态', async () => {
    findMock.mockResolvedValue([
      makeEvent({ event_id: 'e-ok', status: EventStatus.PENDING }),
      makeEvent({ event_id: 'e-rej', status: EventStatus.REJECTED }),
      makeEvent({ event_id: 'e-dup', status: EventStatus.DUPLICATED }),
    ]);
    qbMock.getMany.mockResolvedValue([]);
    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.map((e) => e.event_id)).toEqual(['e-ok']);
  });

  it('30 天外的事件不进入兜底 (cutoff 正确)', async () => {
    findMock.mockResolvedValue([]);
    await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    // cutoff 应该是 comment_time - 30 天
    const cutoffCall = qbMock.where.mock.calls[0];
    const cutoffArg = cutoffCall[1].cutoff;
    const expected = new Date('2026-07-09T10:00:00Z').getTime() - 30 * 86400 * 1000;
    expect(cutoffArg.getTime()).toBe(expected);
  });

  it('兜底查询失败 → 主路不受影响, 仅 warn', async () => {
    findMock.mockResolvedValue([makeEvent({ event_id: 'main-1' })]);
    qbMock.getMany.mockRejectedValue(new Error('DB down'));
    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.length).toBe(1);
    expect(out[0].event_id).toBe('main-1');
  });

  it('animalId 空 → 跳过 Step 1, 仅走兜底', async () => {
    findMock.mockResolvedValue([]);
    qbMock.getMany.mockResolvedValue([makeEvent({ event_id: 'fb-1' })]);
    const out = await service.recall('', new Date('2026-07-09T10:00:00Z'));
    // 兜底仍会跑
    expect(qbMock.where).toHaveBeenCalled();
    // 兜底里也过滤 status
    expect(out.map((e) => e.event_id)).toEqual(['fb-1']);
  });

  it('排序: occurred_at DESC', async () => {
    findMock.mockResolvedValue([
      makeEvent({ event_id: 'old', occurred_at: new Date('2026-07-01T08:00:00Z') }),
      makeEvent({ event_id: 'new', occurred_at: new Date('2026-07-08T08:00:00Z') }),
    ]);
    qbMock.getMany.mockResolvedValue([
      makeEvent({ event_id: 'fallback', occurred_at: new Date('2026-07-05T08:00:00Z') }),
    ]);
    const out = await service.recall('a-1', new Date('2026-07-09T10:00:00Z'));
    expect(out.map((e) => e.event_id)).toEqual(['new', 'fallback', 'old']);
  });
});
