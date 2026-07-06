import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';
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