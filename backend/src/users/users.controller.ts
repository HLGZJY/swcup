import { Controller, Get, Patch, Post, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
  @UseInterceptors(FileInterceptor('file', { storage: avatarStorage, fileFilter: avatarFilter }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new Error('未选择图片');
    const avatarUrl = `/static/uploads/avatars/${file.filename}`;
    await this.usersService.update(req.user.user_id, { avatar_url: avatarUrl });
    return { avatar_url: avatarUrl };
  }

  @Post('admin/users/:id/avatar/reset')
  @ApiOperation({ summary: '管理员重置用户头像' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async resetUserAvatar(@Param('id') userId: string) {
    await this.usersService.resetAvatar(userId);
    return { message: '头像已重置' };
  }
}
