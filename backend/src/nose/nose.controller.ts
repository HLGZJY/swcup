import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { NoseService } from './nose.service';
import { CollectNoseDto, CompareNoseDto } from './dto/nose.dto';

@ApiTags('鼻纹')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nose')
export class NoseController {
  constructor(private readonly noseService: NoseService) {}

  @Post('collect')
  @ApiOperation({ summary: '鼻纹采集' })
  collect(@Body() dto: CollectNoseDto, @Request() req: any) {
    return this.noseService.collect(dto, req?.user?.user_id);
  }

  @Public()
  @Post('compare')
  @ApiOperation({ summary: '鼻纹比对' })
  compare(@Body() dto: CompareNoseDto, @Request() req: any) {
    return this.noseService.compare(dto, req?.user?.user_id);
  }

  @Public()
  @Post('classify')
  @ApiOperation({ summary: 'AI 品种分类（全身照）' })
  classify(@Body() dto: { image: string }) {
    return this.noseService.classify(dto)
  }

  // Bug 3 修复 (2026-07-08): 用户主动建档走 pending 流程
  //   不再直接 POST /v2/animals,改为提交待审记录,admin 审核通过后才落库
  // 【Defect 3 修复 / 2026-07-08】取消 @Public() — 必须 JWT 鉴权,确保 collector_id 有归属
  //   之前 @Public() 让 req.user 永远为空,service 抛 400 让前端误以为是业务校验失败
  //   改为标准 401,前端能跳登录页
  @Post('pending-animal-request')
  @ApiOperation({ summary: '提交待审动物档案（用户主动建档 → admin 审核）' })
  createPendingAnimalRequest(@Body() dto: any, @Request() req: any) {
    return this.noseService.createPendingAnimalRequest(dto, req?.user?.user_id);
  }
}