import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CollectNoseDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nose_photo?: string;

  @ApiPropertyOptional({ enum: ['cat', 'dog', 'other'] })
  @IsString()
  @IsOptional()
  species?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  location_lat?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  location_lng?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nose_photo_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ enum: ['male', 'female', 'unknown'] })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ enum: ['small', 'medium', 'large'] })
  @IsString()
  @IsOptional()
  size?: string;

  @ApiPropertyOptional({ enum: ['short', 'medium', 'long'] })
  @IsString()
  @IsOptional()
  coat_length?: string;

  @ApiPropertyOptional({ enum: ['erect', 'floppy'] })
  @IsString()
  @IsOptional()
  ear_type?: string;

  @ApiPropertyOptional({ enum: ['long', 'short', 'curled'] })
  @IsString()
  @IsOptional()
  tail_type?: string;

  @ApiPropertyOptional({ description: '全身照 Base64' })
  @IsString()
  @IsOptional()
  body_photo?: string;

  @ApiPropertyOptional({ description: '全身照上传后的 URL' })
  @IsString()
  @IsOptional()
  body_photo_url?: string;

  // 【2026-07-09 补回】T3 重构 collect 时,nose.service 用到了 dto.address / dto.notes,
  //   但 DTO 没声明这两个字段,导致 TS2345 编译错误。现补回为可选字段,前端按需发送。
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  // 【2026-07-14 bug4】三属性透传 — 之前前端只通过 URL 透传 result.vue 内部 state,
  //   collect 端从未写入,导致 admin 审核创建动物时丢成 null/unknown/false。
  //   扩 DTO enum 与前端 collect 表单 (junior/adult/senior/unknown + healthy/injured/sick/unknown + boolean) 对齐。
  @ApiPropertyOptional({ enum: ['junior', 'adult', 'senior', 'unknown'] })
  @IsEnum(['junior', 'adult', 'senior', 'unknown'])
  @IsOptional()
  age_estimate?: 'junior' | 'adult' | 'senior' | 'unknown';

  @ApiPropertyOptional({ enum: ['healthy', 'injured', 'sick', 'unknown'] })
  @IsEnum(['healthy', 'injured', 'sick', 'unknown'])
  @IsOptional()
  health_status?: 'healthy' | 'injured' | 'sick' | 'unknown';

  @ApiPropertyOptional({
    description: 'true=已绝育, false=未绝育, null/undefined=用户未填(Animal 默认 false)',
  })
  @IsOptional()
  @IsBoolean()
  sterilized?: boolean | null;
}

export class CompareNoseDto {
  @ApiPropertyOptional({ description: '鼻纹记录ID' })
  @IsString()
  @IsOptional()
  vector_id?: string;

  // 兼容前端传入的 nose_id 别名
  @ApiPropertyOptional({ description: '鼻纹记录ID（兼容）' })
  @IsString()
  @IsOptional()
  nose_id?: string;

  @ApiPropertyOptional({ enum: ['cat', 'dog', 'other'] })
  @IsString()
  @IsOptional()
  species?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  location_lat?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  location_lng?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  photo_base64?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nose_photo_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ enum: ['male', 'female', 'unknown'] })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ enum: ['small', 'medium', 'large'] })
  @IsString()
  @IsOptional()
  size?: string;

  @ApiPropertyOptional({ enum: ['short', 'medium', 'long'] })
  @IsString()
  @IsOptional()
  coat_length?: string;

  @ApiPropertyOptional({ enum: ['erect', 'floppy'] })
  @IsString()
  @IsOptional()
  ear_type?: string;

  @ApiPropertyOptional({ enum: ['long', 'short', 'curled'] })
  @IsString()
  @IsOptional()
  tail_type?: string;
}