import { Controller, Get, Patch, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { avatarStorage, avatarFilter } from '../common/multer.config';

@ApiTags('用户')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.user_id);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  updateMe(@Body() dto: { nickname?: string; avatar_url?: string; role?: string }, @Request() req: any) {
    return this.usersService.update(req.user.user_id, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: '上传头像' })
  @UseInterceptors(AnyFilesInterceptor({ storage: avatarStorage, fileFilter: avatarFilter }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new Error('未选择图片');
    const avatarUrl = `/static/uploads/avatars/${file.filename}`;
    await this.usersService.update(req.user.user_id, { avatar_url: avatarUrl });
    return { avatar_url: avatarUrl };
  }
}
