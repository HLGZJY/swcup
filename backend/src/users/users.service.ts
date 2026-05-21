import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async findById(user_id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { user_id } });
  }

  async findAll() {
    const users = await this.userRepo.find({ order: { created_at: 'DESC' } });
    return users.map(u => ({
      user_id: u.user_id,
      nickname: u.nickname,
      phone: u.phone ? u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      role: u.role,
      created_at: u.created_at,
    }));
  }

  async update(user_id: string, dto: { nickname?: string; avatar_url?: string }) {
    await this.userRepo.update({ user_id }, dto);
    return this.findById(user_id);
  }
}