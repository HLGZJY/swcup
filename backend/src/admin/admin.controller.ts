import { Controller, Get, Post, Put, Delete, Param, Query, UseGuards, Body } from '@nestjs/common';
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

  @Get('stats')
  @ApiOperation({ summary: '统计数据' })
  stats() {
    return this.adminService.stats();
  }

  @Get('events')
  @ApiOperation({ summary: '事件列表' })
  events(@Query() query: any) {
    return this.adminService.getEvents(query);
  }

  @Get('events/:event_id')
  @ApiOperation({ summary: '事件详情' })
  eventDetail(@Param('event_id') id: string) {
    return this.adminService.getEventDetail(id);
  }

  @Put('events/:event_id/confirm')
  @ApiOperation({ summary: '确认重复事件' })
  confirmEvent(@Param('event_id') id: string) {
    return this.adminService.confirmEvent(id);
  }

  @Put('events/:event_id/reject')
  @ApiOperation({ summary: '驳回事件' })
  rejectEvent(@Param('event_id') id: string) {
    return this.adminService.rejectEvent(id);
  }

  @Post('events/:event_id/process')
  @ApiOperation({ summary: '处理事件（AI识别）' })
  processEvent(@Param('event_id') id: string) {
    return this.eventsService.processEvent(id);
  }

  @Get('claims')
  @ApiOperation({ summary: '认领申请列表' })
  claims(@Query() query: any) {
    return this.adminService.getClaims(query);
  }

  @Get('claims/:claim_id')
  @ApiOperation({ summary: '认领详情' })
  claimDetail(@Param('claim_id') id: string) {
    return this.adminService.getClaimDetail(id);
  }

  @Put('claims/:claim_id/approve')
  @ApiOperation({ summary: '审批认领' })
  approveClaim(@Param('claim_id') id: string) {
    return this.adminService.approveClaim(id, 'admin');
  }

  @Put('claims/:claim_id/reject')
  @ApiOperation({ summary: '拒绝认领' })
  rejectClaim(@Param('claim_id') id: string) {
    return this.adminService.rejectClaim(id);
  }

  @Get('animals')
  @ApiOperation({ summary: '动物列表（管理）' })
  animals(@Query() query: any) {
    return this.animalsService.findAll(query);
  }

  @Get('animals/:animal_id')
  @ApiOperation({ summary: '动物详情' })
  animalDetail(@Param('animal_id') id: string) {
    return this.animalsService.findOne(id);
  }

  @Post('animals')
  @ApiOperation({ summary: '新增动物' })
  createAnimal(@Body() dto: any) {
    return this.animalsService.create(dto);
  }

  @Put('animals/:animal_id')
  @ApiOperation({ summary: '更新动物' })
  updateAnimal(@Param('animal_id') id: string, @Body() dto: any) {
    return this.animalsService.update(id, dto);
  }

  @Delete('animals/:animal_id')
  @ApiOperation({ summary: '删除动物' })
  deleteAnimal(@Param('animal_id') id: string) {
    return this.animalsService.remove(id);
  }

  @Get('users')
  @ApiOperation({ summary: '用户列表' })
  users() {
    return this.adminService.getUsers();
  }
}
