import { Controller, Get, Post, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('救助事件')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: '上报救助事件' })
  create(@Body() dto: CreateEventDto, @Request() req: any) {
    return this.eventsService.create(dto, req.user.user_id);
  }

  @Post(':event_id/link')
  @ApiOperation({ summary: '用户自助关联事件到动物' })
  linkEventToAnimal(
    @Param('event_id') id: string,
    @Body() body: { animal_id: string },
    @Request() req: any,
  ) {
    return this.eventsService.linkToAnimal(id, body.animal_id, req.user.user_id);
  }

  @Get('my')
  @ApiOperation({ summary: '获取我的上报事件' })
  myEvents(@Request() req: any) {
    return this.eventsService.findByReporter(req.user.user_id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('')
  @ApiOperation({ summary: '事件列表（管理端）' })
  findAll(@Query() query: any) {
    return this.eventsService.findAll(query);
  }
}