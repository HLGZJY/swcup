import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(phone: string, password: string) {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (!user.password_hash) {
      throw new UnauthorizedException('密码未设置，请使用微信登录');
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    const token = this.jwtService.sign({ user_id: user.user_id, role: user.role });
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async weixinLogin(code: string) {
    const wxAppId = process.env.WX_APPID;
    const wxSecret = process.env.WX_SECRET;

    let openid: string;
    let sessionKey: string | undefined;
    try {
      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxSecret}&js_code=${code}&grant_type=authorization_code`,
        { method: 'GET' }
      );
      const wxData = await wxRes.json() as { openid?: string; session_key?: string; errcode?: number; errmsg?: string };
      if (!wxData.openid) {
        throw new Error(wxData.errmsg || '微信授权失败');
      }
      openid = wxData.openid;
      sessionKey = wxData.session_key;
    } catch (err) {
      throw new Error('微信授权失败，请稍后重试');
    }

    // 先查是否存在，不存在才新建（避免每次 upsert 生成新 UUID）
    let user = await this.userRepo.findOne({ where: { openid } });
    if (!user) {
      user = this.userRepo.create({
        user_id: uuidv4(),
        openid,
        nickname: '',
        phone: null,
        password_hash: null,
        role: UserRole.USER,
        agreed_privacy_at: new Date(),
      });
      await this.userRepo.save(user);
    } else if (!user.agreed_privacy_at) {
      // 补充隐私协议记录
      user.agreed_privacy_at = new Date();
      await this.userRepo.save(user);
    }

    const token = this.jwtService.sign({ user_id: user.user_id, role: user.role });
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async register(phone: string, password: string) {
    // 密码强度校验
    if (!/(?=.*[a-zA-Z])(?=.*\d).{8,}/.test(password)) {
      throw new BadRequestException('密码最短8位，需包含字母和数字');
    }

    // 检查手机号是否已注册
    const existing = await this.userRepo.findOne({ where: { phone } });
    if (existing) {
      throw new ConflictException('该手机号已注册，请直接登录');
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      user_id: uuidv4(),
      nickname: '',
      phone,
      password_hash,
      openid: null,
      role: UserRole.USER,
      agreed_privacy_at: new Date(),
    });
    await this.userRepo.save(user);

    const token = this.jwtService.sign({ user_id: user.user_id, role: user.role });
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  // Mock 验证码存储（比赛用：固定 888888）
  private mockCodes: Map<string, { code: string; expiresAt: number }> = new Map();

  async sendCode(phone: string) {
    // 比赛模式：固定验证码 888888
    const code = '888888';
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟过期
    this.mockCodes.set(phone, { code, expiresAt });
    console.log(`[Mock SMS] 手机号 ${phone} 的验证码是：${code}`);
    return { message: '验证码已发送' };
  }

  async bindPhone(phone: string, code: string, user_id: string, password: string) {
    // 验证码校验
    const stored = this.mockCodes.get(phone);
    if (!stored || stored.code !== code) {
      throw new BadRequestException('验证码错误');
    }
    if (Date.now() > stored.expiresAt) {
      throw new BadRequestException('验证码已过期');
    }
    this.mockCodes.delete(phone);

    // 更新字段
    if (!/(?=.*[a-zA-Z])(?=.*\d).{8,}/.test(password)) {
      throw new BadRequestException('密码最短8位，需包含字母和数字');
    }
    await this.userRepo.update({ user_id }, {
      phone,
      password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
    const user = await this.userRepo.findOne({ where: { user_id } });
    return {
      message: '绑定成功',
      user: this.sanitizeUser(user!),
    };
  }

  async resetPassword(phone: string, code: string, password: string) {
    // 验证码校验
    const stored = this.mockCodes.get(phone);
    if (!stored || stored.code !== code) {
      throw new BadRequestException('验证码错误');
    }
    if (Date.now() > stored.expiresAt) {
      throw new BadRequestException('验证码已过期');
    }
    this.mockCodes.delete(phone);

    // 检查用户是否存在
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('该手机号未注册，请先注册');
    }

    // 密码强度校验
    if (!/(?=.*[a-zA-Z])(?=.*\d).{8,}/.test(password)) {
      throw new BadRequestException('密码最短8位，需包含字母和数字');
    }

    // 更新密码
    await this.userRepo.update({ user_id: user.user_id }, {
      password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });

    const token = this.jwtService.sign({ user_id: user.user_id, role: user.role });
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: User) {
    return {
      user_id: user.user_id,
      nickname: user.nickname,
      phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      openid: user.openid,
      role: user.role,
      created_at: user.created_at,
    };
  }
}