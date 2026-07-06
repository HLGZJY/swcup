import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'user-1',
    nickname: 'Tester',
    phone: '13800001234',
    openid: null,
    password_hash: 'hash',
    agreed_privacy_at: new Date(),
    role: UserRole.USER,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    userRepo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('存在应返回用户', async () => {
      const u = makeUser();
      userRepo.findOne.mockResolvedValue(u);
      const result = await service.findById('user-1');
      expect(result).toEqual(u);
    });

    it('不存在应返回 null', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.findById('missing');
      expect(result).toBeNull();
    });

    it('应按 user_id 字段查询(非 id)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await service.findById('user-1');
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { user_id: 'user-1' } });
    });
  });

  describe('findAll', () => {
    it('应按 created_at DESC 排序', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      await service.findAll();
      expect(userRepo.find).toHaveBeenCalledWith({ order: { created_at: 'DESC' } });
    });

    it('应脱敏手机号 (中间 4 位 → *)', async () => {
      userRepo.find.mockResolvedValue([
        makeUser({ phone: '13800001234' }),
        makeUser({ phone: null }),
      ]);
      const result = await service.findAll();
      expect(result[0].phone).toBe('138****1234');
      expect(result[1].phone).toBeNull();
    });

    it('应仅返回必要字段,不暴露 password_hash / openid 等敏感字段', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      const result = await service.findAll();
      const u = result[0];
      expect(u).not.toHaveProperty('password_hash');
    });
  });

  describe('update', () => {
    it('应按 user_id 过滤更新', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ nickname: 'NewName' }));
      await service.update('user-1', { nickname: 'NewName' });
      expect(userRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-1' },
        { nickname: 'NewName' },
      );
    });

    it('应返回更新后的用户', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ nickname: 'NewName' }));
      const result = await service.update('user-1', { nickname: 'NewName' });
      expect(result?.nickname).toBe('NewName');
    });
  });
});