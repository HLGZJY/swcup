import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '13800000001', description: '手机号' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'password123', description: '密码' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class WeixinLoginDto {
  @ApiProperty({ example: 'xxxxxxxxxxxxxxxxxxxx', description: 'wx.login() 返回的登录凭证' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class RegisterDto {
  @ApiProperty({ example: '13800000002', description: '手机号' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'password123', description: '密码' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class SendCodeDto {
  @ApiProperty({ example: '13800000001', description: '手机号' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class BindPhoneDto {
  @ApiProperty({ example: '13800000001', description: '手机号' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '888888', description: '短信验证码' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'password123', description: '设置密码（可选）' })
  @IsString()
  @IsOptional()
  password?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '13800000001', description: '手机号' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '888888', description: '短信验证码' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'password123', description: '新密码（8位，需包含字母和数字）' })
  @IsString()
  @IsNotEmpty()
  password: string;
}