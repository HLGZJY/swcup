import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';

// Mock user factory
function makeUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'user-uuid-1',
    nickname: 'TestUser',
    phone: '13800000001',
    openid: null,
    password_hash: null,
    agreed_privacy_at: new Date(),
    role: UserRole.USER,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as User;
}

// Mock Repository
function makeRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => entity),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

// Mock JwtService
function makeJwt() {
  return {
    sign: jest.fn((payload) => `mock.jwt.${payload.user_id}`),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof makeRepo>;
  let jwtService: ReturnType<typeof makeJwt>;

  beforeEach(async () => {
    userRepo = makeRepo();
    jwtService = makeJwt();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ========== login ==========
  describe('login', () => {
    it('用户不存在应抛 UnauthorizedException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login('13800000001', 'pass1234'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('用户无 password_hash(仅微信登录用户)应抛 UnauthorizedException', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ password_hash: null }));
      await expect(service.login('13800000001', 'pass1234'))
        .rejects.toThrow('密码未设置');
    });

    it('密码错误应抛 UnauthorizedException', async () => {
      const hash = await bcrypt.hash('correct123', 10);
      userRepo.findOne.mockResolvedValue(makeUser({ password_hash: hash }));
      await expect(service.login('13800000001', 'wrongpass'))
        .rejects.toThrow('手机号或密码错误');
    });

    it('密码正确应返回 token + 脱敏用户信息', async () => {
      const hash = await bcrypt.hash('correct123', 10);
      const user = makeUser({ password_hash: hash });
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.login('13800000001', 'correct123');

      expect(result.token).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledWith({
        user_id: user.user_id,
        role: user.role,
      });
      // 手机号脱敏
      expect(result.user.phone).toBe('138****0001');
      expect(result.user.user_id).toBe(user.user_id);
      // password_hash 不应返回
      expect(result.user).not.toHaveProperty('password_hash');
    });
  });

  // ========== register ==========
  describe('register', () => {
    it('弱密码(短于8位)应抛 BadRequestException', async () => {
      await expect(service.register('13800000001', '123'))
        .rejects.toThrow('密码最短8位');
    });

    it('弱密码(无字母)应抛 BadRequestException', async () => {
      await expect(service.register('13800000001', '12345678'))
        .rejects.toThrow('密码最短8位');
    });

    it('弱密码(无数字)应抛 BadRequestException', async () => {
      await expect(service.register('13800000001', 'abcdefgh'))
        .rejects.toThrow('密码最短8位');
    });

    it('已注册手机号应抛 ConflictException', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(service.register('13800000001', 'valid1234'))
        .rejects.toThrow(ConflictException);
    });

    it('新手机号+强密码应成功注册并返回 token', async () => {
      userRepo.findOne.mockResolvedValue(null);  // 手机号未注册

      const result = await service.register('13800000001', 'valid1234');

      expect(result.token).toBeDefined();
      expect(result.user.role).toBe(UserRole.USER);
      // 密码应已被 hash 存储(不应明文)
      expect(userRepo.save).toHaveBeenCalled();
      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.password_hash).not.toBe('valid1234');
      expect(saved.password_hash.length).toBeGreaterThan(20);
      // 隐私协议时间应被设置
      expect(saved.agreed_privacy_at).toBeInstanceOf(Date);
    });
  });

  // ========== sendCode ==========
  describe('sendCode', () => {
    it('应返回成功消息', async () => {
      const result = await service.sendCode('13800000001');
      expect(result.message).toBe('验证码已发送');
    });

    it('比赛模式验证码应固定为 888888', async () => {
      // 发送后再 bindPhone 验证 888888 有效
      await service.sendCode('13800000001');
      // bindPhone 走同一内存 mockCodes map
      userRepo.findOne.mockResolvedValue(makeUser({ user_id: 'u1' }));
      const result = await service.bindPhone('13800000001', '888888', 'u1', 'newPass123');
      expect(result.message).toBe('绑定成功');
    });
  });

  // ========== bindPhone ==========
  describe('bindPhone', () => {
    beforeEach(async () => {
      await service.sendCode('13800000001');
    });

    it('验证码错误应抛 BadRequestException', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(service.bindPhone('13800000001', 'wrongcode', 'u1', 'newPass123'))
        .rejects.toThrow('验证码错误');
    });

    it('未发送验证码(无记录)应抛 BadRequestException', async () => {
      await expect(service.bindPhone('13800000999', '888888', 'u1', 'newPass123'))
        .rejects.toThrow('验证码错误');
    });

    it('弱密码应抛 BadRequestException(验证码仍有效)', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(service.bindPhone('13800000001', '888888', 'u1', 'weak'))
        .rejects.toThrow('密码最短8位');
    });

    it('正确验证码+强密码应绑定成功并更新密码 hash', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ user_id: 'u1', phone: null }));

      const result = await service.bindPhone('13800000001', '888888', 'u1', 'newPass123');

      expect(result.message).toBe('绑定成功');
      expect(userRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1' },
        expect.objectContaining({
          phone: '13800000001',
          password_hash: expect.stringMatching(/^\$2[ayb]\$.{56}$/),
        }),
      );
    });

    it('验证码一经使用应失效(下次同号同码应失败)', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ user_id: 'u1' }));
      await service.bindPhone('13800000001', '888888', 'u1', 'firstPass123');

      await expect(service.bindPhone('13800000001', '888888', 'u2', 'secondPass123'))
        .rejects.toThrow('验证码错误');
    });
  });

  // ========== resetPassword ==========
  describe('resetPassword', () => {
    beforeEach(async () => {
      await service.sendCode('13800000001');
    });

    it('未发送验证码应抛 BadRequestException', async () => {
      await expect(service.resetPassword('13800000999', '888888', 'newPass123'))
        .rejects.toThrow('验证码错误');
    });

    it('用户不存在应抛 BadRequestException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword('13800000001', '888888', 'newPass123'))
        .rejects.toThrow('该手机号未注册');
    });

    it('弱密码应抛 BadRequestException', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(service.resetPassword('13800000001', '888888', 'weak'))
        .rejects.toThrow('密码最短8位');
    });

    it('正确验证码+强密码应重置密码并返回 token', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ password_hash: 'oldhash' }));

      const result = await service.resetPassword('13800000001', '888888', 'newPass123');

      expect(result.token).toBeDefined();
      // 应更新密码
      expect(userRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-uuid-1' },
        expect.objectContaining({
          password_hash: expect.stringMatching(/^\$2[ayb]\$.{56}$/),
        }),
      );
    });
  });

  // ========== weixinLogin ==========
  describe('weixinLogin', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, WX_APPID: 'wx_test_appid', WX_SECRET: 'wx_test_secret' };
      // @ts-ignore - 替换全局 fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('微信授权失败(无 openid)应抛 Error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ errcode: 40029, errmsg: 'invalid code' }),
      });
      await expect(service.weixinLogin('bad_code'))
        .rejects.toThrow('微信授权失败');
    });

    it('新 openid 应自动创建用户', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ openid: 'new_openid_123', session_key: 'sk' }),
      });
      userRepo.findOne.mockResolvedValue(null);  // 用户不存在

      const result = await service.weixinLogin('valid_code');

      expect(result.token).toBeDefined();
      expect(userRepo.save).toHaveBeenCalled();
      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.openid).toBe('new_openid_123');
      expect(saved.role).toBe(UserRole.USER);
      expect(saved.agreed_privacy_at).toBeInstanceOf(Date);
    });

    it('已存在用户应直接登录,不应新建', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ openid: 'existing_openid', session_key: 'sk' }),
      });
      userRepo.findOne.mockResolvedValue(makeUser({
        user_id: 'existing-user',
        openid: 'existing_openid',
        agreed_privacy_at: new Date(),
      }));

      const result = await service.weixinLogin('valid_code');

      expect(result.token).toBeDefined();
      // 不应再次 save
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('已存在用户但未签隐私协议应补签', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ openid: 'old_openid', session_key: 'sk' }),
      });
      userRepo.findOne.mockResolvedValue(makeUser({
        openid: 'old_openid',
        agreed_privacy_at: null,
      }));

      const result = await service.weixinLogin('valid_code');

      expect(result.token).toBeDefined();
      expect(userRepo.save).toHaveBeenCalled();
      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.agreed_privacy_at).toBeInstanceOf(Date);
    });

    it('fetch 抛网络异常应抛 Error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
      await expect(service.weixinLogin('any_code'))
        .rejects.toThrow('微信授权失败，请稍后重试');
    });
  });
});