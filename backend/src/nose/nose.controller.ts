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

  @Public()
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
}