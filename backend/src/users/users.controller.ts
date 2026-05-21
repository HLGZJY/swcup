import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

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

  @Put('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  updateMe(@Body() dto: { nickname?: string; avatar_url?: string }, @Request() req: any) {
    return this.usersService.update(req.user.user_id, dto);
  }
}
