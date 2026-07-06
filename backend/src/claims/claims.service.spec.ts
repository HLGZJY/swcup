import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClaimsService } from './claims.service';
import { Claim, ClaimStatus } from './entities/claim.entity';

function makeRepo() {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  return {
    create: jest.fn((dto) => dto),
    save: jest.fn(async (e) => e),
    find: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
  };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    claim_id: 'claim-1',
    animal_id: 'animal-1',
    claimer_id: 'user-1',
    event_id: null,
    claimed_at: new Date(),
    status: ClaimStatus.PENDING,
    notes: null,
    proof_photos: null,
    approved_by: null,
    approved_at: null,
    created_at: new Date(),
    ...overrides,
  } as Claim;
}

describe('ClaimsService', () => {
  let service: ClaimsService;
  let claimRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    claimRepo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        { provide: getRepositoryToken(Claim), useValue: claimRepo },
      ],
    }).compile();
    service = module.get<ClaimsService>(ClaimsService);
  });

  // ========== create ==========
  describe('create', () => {
    it('应创建 claim 并设置 status=pending', async () => {
      const dto = { animal_id: 'animal-1' };
      const result = await service.create(dto as any, 'user-1');
      expect(result.status).toBe('pending');
      expect(result.claim_id).toBeDefined();
      expect(claimRepo.save).toHaveBeenCalled();
    });

    it('应正确传 claimer_id 和 animal_id', async () => {
      await service.create({ animal_id: 'a-1', event_id: 'e-1' } as any, 'user-2');
      const saved = claimRepo.save.mock.calls[0][0];
      expect(saved.animal_id).toBe('a-1');
      expect(saved.claimer_id).toBe('user-2');
      expect(saved.event_id).toBe('e-1');
    });

    it('event_id/notes 可选,缺省时不应被写入', async () => {
      await service.create({ animal_id: 'a-1' } as any, 'user-1');
      const saved = claimRepo.save.mock.calls[0][0];
      expect(saved.event_id).toBeUndefined();
      expect(saved.notes).toBeUndefined();
    });
  });

  // ========== findByClaimer ==========
  describe('findByClaimer', () => {
    it('应按 claimer_id 过滤,created_at DESC', async () => {
      claimRepo.find.mockResolvedValue([]);
      await service.findByClaimer('user-1');
      expect(claimRepo.find).toHaveBeenCalledWith({
        where: { claimer_id: 'user-1' },
        order: { created_at: 'DESC' },
      });
    });
  });

  // ========== findAll ==========
  describe('findAll', () => {
    it('应 join claimer + animal,带分页', async () => {
      claimRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 2, limit: 10 } as any);
      expect(claimRepo._qb.skip).toHaveBeenCalledWith(10);
      expect(claimRepo._qb.take).toHaveBeenCalledWith(10);
      expect(claimRepo._qb.leftJoinAndSelect).toHaveBeenCalledWith('c.claimer', 'u');
      expect(claimRepo._qb.leftJoinAndSelect).toHaveBeenCalledWith('c.animal', 'a');
    });

    it('按 status 过滤', async () => {
      claimRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ status: 'pending' } as any);
      expect(claimRepo._qb.andWhere).toHaveBeenCalledWith('c.status = :status', { status: 'pending' });
    });

    it('应脱敏用户手机号', async () => {
      claimRepo._qb.getManyAndCount.mockResolvedValue([
        [{
          claim_id: 'c-1',
          animal_id: 'a-1',
          event_id: null,
          claimer_id: 'u-1',
          notes: null,
          status: 'pending',
          created_at: new Date(),
          claimer: {
            user_id: 'u-1',
            nickname: 'X',
            phone: '13800001234',
          },
          animal: {
            animal_id: 'a-1',
            species: 'dog',
            breed: 'shiba',
            color: 'yellow',
          },
        }],
        1,
      ]);

      const result = await service.findAll({} as any);
      expect(result.list[0].user.phone).toBe('138****1234');
      expect(result.list[0].animal.breed).toBe('shiba');
    });

    it('claim 为 null 时 user/animal 字段应返回 null', async () => {
      claimRepo._qb.getManyAndCount.mockResolvedValue([
        [{
          claim_id: 'c-1',
          animal_id: 'a-1',
          event_id: null,
          claimer_id: 'u-1',
          notes: null,
          status: 'pending',
          created_at: new Date(),
          claimer: null,
          animal: null,
        }],
        1,
      ]);

      const result = await service.findAll({} as any);
      expect(result.list[0].user).toBeNull();
      expect(result.list[0].animal).toBeNull();
    });
  });

  // ========== approve ==========
  describe('approve', () => {
    it('应设置 status=approved + approved_by + approved_at', async () => {
      claimRepo.update.mockResolvedValue({ affected: 1 });
      const before = Date.now();
      await service.approve('claim-1', 'admin-1');
      const after = Date.now();

      expect(claimRepo.update).toHaveBeenCalledWith(
        { claim_id: 'claim-1' },
        expect.objectContaining({
          status: 'approved',
          approved_by: 'admin-1',
          approved_at: expect.any(Date),
        }),
      );

      const calledAt = claimRepo.update.mock.calls[0][1].approved_at as Date;
      expect(calledAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(calledAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  // ========== reject ==========
  describe('reject', () => {
    it('应设置 status=rejected', async () => {
      claimRepo.update.mockResolvedValue({ affected: 1 });
      await service.reject('claim-1');
      expect(claimRepo.update).toHaveBeenCalledWith(
        { claim_id: 'claim-1' },
        { status: 'rejected' },
      );
    });
  });
});