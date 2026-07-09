import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsArray, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 【2026-07-09】二次目击 DTO
 * 区别于"上报走失" — POST /events,该接口仅更新 animal 的最新目击位置,
 * 不创建 rescue_event,不入审核流。
 */
export class CreateSightingDto {
  @ApiPropertyOptional({ description: '目击者当前位置纬度' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  reporter_lat?: number;

  @ApiPropertyOptional({ description: '目击者当前位置经度' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  reporter_lng?: number;

  @ApiPropertyOptional({ description: '目击地点' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ type: [String], description: '目击照片' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ description: '目击备注' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: '目击时间 ISO 8601,默认 now' })
  @IsDateString()
  @IsOptional()
  seen_at?: string;
}
