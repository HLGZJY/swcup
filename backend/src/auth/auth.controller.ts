import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, WeixinLoginDto, SendCodeDto, BindPhoneDto, ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.phone, dto.password);
  }

  @Post('weixin')
  @ApiOperation({ summary: '微信授权登录' })
  weixinLogin(@Body() dto: WeixinLoginDto) {
    return this.authService.weixinLogin(dto.code);
  }

  @Post('send-code')
  @ApiOperation({ summary: '发送验证码' })
  sendCode(@Body() dto: SendCodeDto) {
    return this.authService.sendCode(dto.phone);
  }

  @Post('bind-phone')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '绑定手机号' })
  bindPhone(@Body() dto: BindPhoneDto, @Req() req: any) {
    return this.authService.bindPhone(dto.phone, dto.code, req.user.user_id, dto.password);
  }

  @Post('reset-password')
  @ApiOperation({ summary: '忘记密码重置' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.phone, dto.code, dto.password);
  }
}