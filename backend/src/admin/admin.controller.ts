import { Controller, Get, Post, Put, Delete, Param, Query, UseGuards, Body, Version } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { EventsService } from '../events/events.service';
import { AnimalsService } from '../animals/animals.service';

@ApiTags('管理端')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly eventsService: EventsService,
    private readonly animalsService: AnimalsService,
  ) {}

  @Version('1')
  @Get('stats')
  @ApiOperation({ summary: '统计数据' })
  stats() {
    return this.adminService.stats();
  }

  @Version('1')
  @Get('events')
  @ApiOperation({ summary: '事件列表' })
  events(@Query() query: any) {
    return this.adminService.getEvents(query);
  }

  @Version('1')
  @Get('events/:event_id')
  @ApiOperation({ summary: '事件详情' })
  eventDetail(@Param('event_id') id: string) {
    return this.adminService.getEventDetail(id);
  }

  @Version('1')
  @Put('events/:event_id/confirm')
  @ApiOperation({ summary: '确认重复事件' })
  confirmEvent(@Param('event_id') id: string, @Body() body: { animal_id?: string }) {
    return this.adminService.confirmEvent(id, body.animal_id);
  }

  @Version('1')
  @Put('events/:event_id/reject')
  @ApiOperation({ summary: '驳回事件' })
  rejectEvent(@Param('event_id') id: string) {
    return this.adminService.rejectEvent(id);
  }

  @Version('1')
  @Post('events/:event_id/process')
  @ApiOperation({ summary: '处理事件（AI识别）' })
  processEvent(@Param('event_id') id: string) {
    return this.eventsService.processEvent(id);
  }

  @Version('1')
  @Get('claims')
  @ApiOperation({ summary: '认领申请列表' })
  claims(@Query() query: any) {
    return this.adminService.getClaims(query);
  }

  @Version('1')
  @Get('claims/:claim_id')
  @ApiOperation({ summary: '认领详情' })
  claimDetail(@Param('claim_id') id: string) {
    return this.adminService.getClaimDetail(id);
  }

  @Version('1')
  @Put('claims/:claim_id/approve')
  @ApiOperation({ summary: '审批认领' })
  approveClaim(@Param('claim_id') id: string) {
    return this.adminService.approveClaim(id, 'admin');
  }

  @Version('1')
  @Put('claims/:claim_id/reject')
  @ApiOperation({ summary: '拒绝认领' })
  rejectClaim(@Param('claim_id') id: string) {
    return this.adminService.rejectClaim(id);
  }

  @Version('1')
  @Get('animals')
  @ApiOperation({ summary: '动物列表（管理）' })
  animals(@Query() query: any) {
    return this.animalsService.findAll(query);
  }

  @Version('1')
  @Get('animals/:animal_id')
  @ApiOperation({ summary: '动物详情' })
  animalDetail(@Param('animal_id') id: string) {
    return this.animalsService.findOne(id);
  }

  @Version('1')
  @Post('animals')
  @ApiOperation({ summary: '新增动物' })
  createAnimal(@Body() dto: any) {
    return this.animalsService.create(dto);
  }

  @Version('1')
  @Put('animals/:animal_id')
  @ApiOperation({ summary: '更新动物' })
  updateAnimal(@Param('animal_id') id: string, @Body() dto: any) {
    return this.animalsService.update(id, dto);
  }

  @Version('1')
  @Delete('animals/:animal_id')
  @ApiOperation({ summary: '删除动物' })
  deleteAnimal(@Param('animal_id') id: string) {
    return this.animalsService.remove(id);
  }

  @Version('1')
  @Get('users')
  @ApiOperation({ summary: '用户列表' })
  async users(@Query() query: { page?: number; limit?: number; role?: string; keyword?: string }) {
    return this.adminService.getUsers(query);
  }

  @Version('1')
  @Get('users/:user_id')
  @ApiOperation({ summary: '用户详情' })
  async getUserDetail(@Param('user_id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Version('1')
  @Get('users/:user_id/events')
  @ApiOperation({ summary: '用户上报事件列表' })
  async getUserEvents(@Param('user_id') userId: string, @Query() query: any) {
    return this.adminService.getUserEvents(userId, query);
  }

  @Version('1')
  @Get('users/:user_id/claims')
  @ApiOperation({ summary: '用户认领记录' })
  async getUserClaims(@Param('user_id') userId: string, @Query() query: any) {
    return this.adminService.getUserClaims(userId, query);
  }

  @Version('1')
  @Get('users/:user_id/animals')
  @ApiOperation({ summary: '用户关联动物' })
  async getUserAnimals(@Param('user_id') userId: string, @Query() query: any) {
    return this.adminService.getUserAnimals(userId, query);
  }

  @Version('1')
  @Put('users/:user_id')
  @ApiOperation({ summary: '更新用户信息' })
  async updateUser(@Param('user_id') userId: string, @Body() body: any) {
    return this.adminService.updateUser(userId, body);
  }
}
