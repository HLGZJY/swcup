import { Controller, Get, Post, Put, Delete, Param, Query, UseGuards, Body, Version, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { EventsService } from '../events/events.service';
import { AnimalsService } from '../animals/animals.service';
import { CreateAnimalDto, UpdateAnimalDto } from '../animals/dto/create-animal.dto';

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
  confirmEvent(@Param('event_id') id: string, @Body() body: { animal_id?: string }) {
    return this.adminService.confirmEvent(id, body.animal_id);
  }

  @Put('events/:event_id/reject')
  @ApiOperation({ summary: '驳回事件' })
  rejectEvent(@Param('event_id') id: string) {
    return this.adminService.rejectEvent(id);
  }

  // 阶段 2 (2026-07-06): admin 端动作闭合端点 — 单一入口接管 4 个动作
  // PUT /admin/events/:event_id/action  body={ action, animal_id? }
  //   action='reject'     → rejectEvent
  //   action='confirm'    → confirmEvent (alias 'merge' 行为相同)
  //   action='merge'      → confirmEvent (语义: 合并事件)
  //   action='create_new' → eventsService.createAnimalFromEvent (建新 Animal + status=confirmed)
  // 兼容: 旧的 PUT /admin/events/:event_id/confirm / reject 端点保留,旧 admin UI 不破坏
  @Put('events/:event_id/action')
  @ApiOperation({
    summary: 'admin 事件动作派发（阶段 2）',
    description: 'action: reject=驳回; confirm=确认合并到现 animal(需 animal_id); merge=同 confirm,UI 语义别名; create_new=从 event 字段建 Animal + 关联 event(status=confirmed)',
  })
  dispatchAction(
    @Param('event_id') id: string,
    @Body() body: { action: 'reject' | 'confirm' | 'merge' | 'create_new'; animal_id?: string },
  ) {
    return this.adminService.dispatchEventAction(id, body.action, body.animal_id);
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
  createAnimal(@Body() dto: CreateAnimalDto) {
    return this.animalsService.create(dto);
  }

    @Put('animals/:animal_id')
  @ApiOperation({ summary: '更新动物' })
  updateAnimal(@Param('animal_id') id: string, @Body() dto: UpdateAnimalDto) {
    return this.animalsService.update(id, dto);
  }

    @Delete('animals/:animal_id')
  @ApiOperation({ summary: '删除动物' })
  deleteAnimal(@Param('animal_id') id: string) {
    return this.animalsService.remove(id);
  }

    @Get('users')
  @ApiOperation({ summary: '用户列表' })
  async users(@Query() query: { page?: number; limit?: number; role?: string; keyword?: string }) {
    return this.adminService.getUsers(query);
  }

    @Get('users/:user_id')
  @ApiOperation({ summary: '用户详情' })
  async getUserDetail(@Param('user_id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

    @Get('users/:user_id/events')
  @ApiOperation({ summary: '用户上报事件列表' })
  async getUserEvents(@Param('user_id') userId: string, @Query() query: any) {
    return this.adminService.getUserEvents(userId, query);
  }

    @Get('users/:user_id/claims')
  @ApiOperation({ summary: '用户认领记录' })
  async getUserClaims(@Param('user_id') userId: string, @Query() query: any) {
    return this.adminService.getUserClaims(userId, query);
  }

    @Get('users/:user_id/animals')
  @ApiOperation({ summary: '用户关联动物' })
  async getUserAnimals(@Param('user_id') userId: string, @Query() query: any) {
    return this.adminService.getUserAnimals(userId, query);
  }

    @Put('users/:user_id')
  @ApiOperation({ summary: '更新用户信息' })
  async updateUser(@Param('user_id') userId: string, @Body() body: any) {
    return this.adminService.updateUser(userId, body);
  }

  // ========== 阶段 3 (2026-07-07): 低分鼻纹人工审核路由 ==========

  @Get('pending-nose-records')
  @ApiOperation({ summary: '低分鼻纹待审核列表' })
  async getPendingNoseRecords(@Query() query: any) {
    return this.adminService.getPendingNoseRecords(query);
  }

  @Get('pending-nose-records/:record_id')
  @ApiOperation({ summary: '低分鼻纹待审核详情' })
  async getPendingNoseRecordDetail(@Param('record_id') record_id: string) {
    return this.adminService.getPendingNoseRecordDetail(record_id);
  }

  @Post('pending-nose-records/:record_id/approve-as-new')
  @ApiOperation({ summary: '审核通过: 确认为新动物' })
  async approveAsNew(
    @Param('record_id') record_id: string,
    @Body() dto: any,
    @Request() req,
  ) {
    const admin_id = req?.user?.user_id || 'system';
    return this.adminService.approvePendingNoseAsNew(record_id, admin_id, dto);
  }

  @Post('pending-nose-records/:record_id/approve-as-duplicate')
  @ApiOperation({ summary: '审核通过: 关联已有动物' })
  async approveAsDuplicate(
    @Param('record_id') record_id: string,
    @Body() body: { animal_id: string },
    @Request() req,
  ) {
    const admin_id = req?.user?.user_id || 'system';
    return this.adminService.approvePendingNoseAsDuplicate(record_id, body.animal_id, admin_id);
  }

  @Post('pending-nose-records/:record_id/reject')
  @ApiOperation({ summary: '审核拒绝' })
  async reject(
    @Param('record_id') record_id: string,
    @Request() req,
  ) {
    const admin_id = req?.user?.user_id || 'system';
    return this.adminService.rejectPendingNoseRecord(record_id, admin_id);
  }
}
