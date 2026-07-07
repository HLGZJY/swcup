// -*- coding: utf-8 -*-

import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';

import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { CommentsService } from './comments.service';

import { CreateCommentDto } from './dto/create-comment.dto';

import { QueryCommentDto } from './dto/query-comment.dto';



@ApiTags('评论')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Post()
  @ApiOperation({ summary: '发表评论 (JWT)' })
  create(@Body() dto: CreateCommentDto, @Request() req: any) {
    return this.service.create(dto, req.user.user_id);
  }

  @Get('animal/:animal_id')
  @ApiOperation({ summary: '列出某动物的可见评论 (JWT)' })
  listByAnimal(
    @Param('animal_id') animalId: string,
    @Query() query: QueryCommentDto,
  ) {
    return this.service.findByAnimal(animalId, query);
  }

  @Get('animal/:animal_id/summary')
  @ApiOperation({ summary: '评论 AI 摘要 (JWT)' })
  async summary(@Param('animal_id') animalId: string) {
    return this.service.summarize(animalId);
  }
}
