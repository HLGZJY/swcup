import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClaimsService } from './claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';

@ApiTags('认领')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  @ApiOperation({ summary: '提交认领申请' })
  create(@Body() dto: CreateClaimDto, @Request() req: any) {
    return this.claimsService.create(dto, req.user.user_id);
  }

  @Get('my')
  @ApiOperation({ summary: '获取我的认领记录' })
  myClaims(@Request() req: any) {
    return this.claimsService.findByClaimer(req.user.user_id);
  }
}