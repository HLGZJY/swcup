import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/create-animal.dto';
import { QueryAnimalDto } from './dto/query-animal.dto';

@ApiTags('动物档案')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '获取动物列表' })
  findAll(@Query() query: QueryAnimalDto) {
    return this.animalsService.findAll(query);
  }

  @Public()
  @Get(':animal_id')
  @ApiOperation({ summary: '获取动物详情' })
  findOne(@Param('animal_id') id: string) {
    return this.animalsService.findOne(id);
  }

  // === Plan B: 用户端创建动物档案（无需 admin 角色）===
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '创建动物档案（用户端，Plan B）' })
  createForUser(@Body() dto: CreateAnimalDto) {
    return this.animalsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  @ApiOperation({ summary: '新建动物档案（管理端）' })
  create(@Body() dto: CreateAnimalDto) {
    return this.animalsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put(':animal_id')
  @ApiOperation({ summary: '更新动物档案' })
  update(@Param('animal_id') id: string, @Body() dto: UpdateAnimalDto) {
    return this.animalsService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':animal_id')
  @ApiOperation({ summary: '删除动物档案' })
  remove(@Param('animal_id') id: string) {
    return this.animalsService.remove(id);
  }
}