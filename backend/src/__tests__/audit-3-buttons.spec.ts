/**
 * 【2026-07-09 重构】admin 审核 3 按钮端到端测试
 *
 * 覆盖规范要求:
 *   - reject      → event.status=rejected
 *   - merge       → event.status=duplicated + animal_id 指向目标 animal
 *   - create_new  → 调 eventsService.createAnimalFromEvent → event.status=confirmed + event.animal_id
 *   - 'confirm'   已废弃:传入 'confirm' 应抛 BadRequestException
 *   - 未知 action 应抛 BadRequestException
 *
 * 测试方式: 单元级 e2e,通过 TestingModule mock 所有 TypeORM repo,
 *   验证 AdminService.dispatchEventAction 走通 3 条分支,不再需要真实 DB
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from '../admin/admin.service';
import { EventsService } from '../events/events.service';
import { RescueEvent, EventType, EventStatus } from '../events/entities/event.entity';
import { Animal } from '../animals/entities/animal.entity';
import { Claim } from '../claims/entities/claim.entity';
import { User } from '../users/entities/user.entity';
import { AnimalsService } from '../animals/animals.service';

function makeRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (e) => e),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
  };
}

describe('Audit 3 actions dispatcher (e2e)', () => {
  let adminService: AdminService;
  let eventsService: any;
  let eventRepo: any;
  let animalRepo: any;
  let claimRepo: any;
  let userRepo: any;

  beforeEach(async () => {
    eventRepo = makeRepo();
    animalRepo = makeRepo();
    claimRepo = makeRepo();
    userRepo = makeRepo();

    eventsService = {
      createAnimalFromEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: getRepositoryToken(Claim), useValue: claimRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: DataSource, useValue: { transaction: (cb) => cb({ findOne: jest.fn(), save: jest.fn(), update: jest.fn() }) } },
        { provide: EventsService, useValue: eventsService },
        { provide: AnimalsService, useValue: {} },
      ],
    }).compile();

    adminService = module.get<AdminService>(AdminService);
  });

  describe('reject action', () => {
    it('应调用 rejectEvent,event.status=rejected', async () => {
      const result = await adminService.dispatchEventAction('E1', 'reject');
      expect(result).toEqual({ action: 'reject', event_id: 'E1', animal_id: null });
      // 验证底层 rejectEvent 调了 eventRepo.update
      expect(eventRepo.update).toHaveBeenCalledWith(
        { event_id: 'E1' },
        { status: EventStatus.REJECTED },
      );
    });

    it('reject 可传 animal_id(忽略)', async () => {
      await adminService.dispatchEventAction('E1', 'reject', 'A1');
      expect(eventRepo.update).toHaveBeenCalledWith(
        { event_id: 'E1' },
        { status: EventStatus.REJECTED },
      );
    });
  });

  describe('merge action', () => {
    it('action=merge + animal_id → 应走 confirmEvent 路径,status=duplicated + animal_id', async () => {
      // mock dataSource.transaction:模拟事件存在 + 动物存在的场景
      // 注意:event.animal_id 必须非空,否则 confirmEvent 走进自动创建 Animal 分支
      //   (admin.service.ts:128 `event.event_type === 'report' && !event.animal_id`),
      //   该分支需要 mock manager.save 返回带 animal_id 的对象,本测试只关心 merge 路径,
      //   所以把 event.animal_id 设为非空,强制走 `if (animal_id)` 的合并分支
      const mockManager = {
        findOne: jest.fn()
          .mockResolvedValueOnce({
            event_id: 'E2',
            event_type: EventType.REPORT,
            reporter_id: 'U1',
            status: EventStatus.PENDING,
            animal_id: 'A_existing',
          })
          .mockResolvedValueOnce({ animal_id: 'A_target', status: 'lost' } as any),
        save: jest.fn(),
        update: jest.fn(async () => ({ affected: 1 })),
      };
      (adminService as any).dataSource = {
        transaction: jest.fn(async (cb) => cb(mockManager)),
      };

      const result = await adminService.dispatchEventAction('E2', 'merge', 'A_target');
      expect(result.action).toBe('merge');
      expect(result.event_id).toBe('E2');
      // 确认调 update 把 animal_id 写到事件上
      expect(mockManager.update).toHaveBeenCalledWith(
        RescueEvent,
        { event_id: 'E2' },
        expect.objectContaining({
          animal_id: 'A_target',
          status: EventStatus.DUPLICATED,
          is_duplicate: true,
        }),
      );
    });

    it('merge 缺 animal_id 应抛 BadRequestException', async () => {
      await expect(
        adminService.dispatchEventAction('E2', 'merge'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create_new action', () => {
    it('应调 eventsService.createAnimalFromEvent,status=confirmed + animal_id', async () => {
      eventsService.createAnimalFromEvent.mockResolvedValue({
        event_id: 'E3',
        animal_id: 'A_newly_created',
      });

      const result = await adminService.dispatchEventAction('E3', 'create_new');
      expect(eventsService.createAnimalFromEvent).toHaveBeenCalledWith('E3');
      expect(result).toEqual({
        action: 'create_new',
        event_id: 'E3',
        animal_id: 'A_newly_created',
      });
    });

    it('create_new 不要求 animal_id(语义是新建,不是绑现 animal)', async () => {
      eventsService.createAnimalFromEvent.mockResolvedValue({
        event_id: 'E3',
        animal_id: 'A_new',
      });
      // 不传 animal_id 不应报 BadRequest
      const result = await adminService.dispatchEventAction('E3', 'create_new');
      expect(result.action).toBe('create_new');
    });
  });

  describe('deprecated confirm action (2026-07-09 移除)', () => {
    it('action=confirm 应抛 BadRequestException(规范已删)', async () => {
      // 'confirm' 已不在 AdminEventAction 类型中,用 as any 强转以模拟旧客户端传错值
      await expect(
        adminService.dispatchEventAction('E1', 'confirm' as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        adminService.dispatchEventAction('E1', 'confirm' as any, 'A1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unknown action', () => {
    it('未知值应抛 BadRequestException', async () => {
      await expect(
        adminService.dispatchEventAction('E1', 'delete' as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        adminService.dispatchEventAction('E1', 'approve_all' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('错误信息应说明合法值', async () => {
      try {
        await adminService.dispatchEventAction('E1', 'foo' as any);
        fail('应抛 BadRequestException');
      } catch (e: any) {
        expect(e.message).toMatch(/reject.*merge.*create_new/);
      }
    });
  });
});
