import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(code: string, nickname: string, avatar_url?: string) {
    // 优先用 phone 精确匹配（已注册用户），其次用 wx_openid 字段
    let user = await this.userRepo.findOne({ where: { phone: code } });
    if (!user) {
      user = await this.userRepo.findOne({ where: { phone: `mock_${code}` } as any });
    }
    if (!user) {
      // 新用户：phone 存原始 code，wx_openid 存 mock_ 前缀
      user = this.userRepo.create({
        user_id: uuidv4(),
        nickname,
        phone: code,
        avatar_url: avatar_url || undefined,
        role: UserRole.USER,
      });
      await this.userRepo.save(user);
    }
    const token = this.jwtService.sign({ user_id: user.user_id, role: user.role });
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async register(code: string, nickname: string, avatar_url?: string) {
    return this.login(code, nickname, avatar_url);
  }

  private sanitizeUser(user: User) {
    return {
      user_id: user.user_id,
      nickname: user.nickname,
      phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      avatar_url: user.avatar_url,
      role: user.role,
      created_at: user.created_at,
    };
  }
}