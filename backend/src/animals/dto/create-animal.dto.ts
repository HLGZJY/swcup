import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean, IsDateString, IsArray, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class BodyColorDto {
  @ApiProperty({ example: 'back', description: '部位 key' })
  @IsString()
  @Matches(/^(back|belly|head|chest|tail|legs|face)$/, {
    message: 'body_colors[].part 必须是 7 个部位 key 之一',
  })
  part: string;

  @ApiProperty({ example: '#8B5A3C' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'body_colors[].hex 必须是 #RRGGBB' })
  hex: string;

  @ApiProperty({ example: '棕色' })
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class CreateAnimalDto {
  @ApiPropertyOptional({ enum: ['lost', 'found', 'claimed', 'archived'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ enum: ['cat', 'dog', 'other'] })
  @IsString()
  @IsNotEmpty()
  species: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiPropertyOptional({ description: '概览色 (旧版单值 / 新版多色时取最高频 label)' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    type: [BodyColorDto],
    description: '多部位取色 (2026-06-26 升级): 3~7 个部位, 每部位 { part, hex, label }',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BodyColorDto)
  body_colors?: BodyColorDto[] | null;

  @ApiPropertyOptional({ enum: ['male', 'female', 'unknown'] })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ enum: ['puppy', 'adult', 'senior'] })
  @IsString()
  @IsOptional()
  age_estimate?: string;

  @ApiPropertyOptional({ enum: ['healthy', 'injured', 'ill', 'unknown'] })
  @IsString()
  @IsOptional()
  health_status?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  sterilized?: boolean;

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

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  first_seen_at?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  last_seen_at?: string;

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
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Matches(/^(?!(undefined|null)$).+/, { each: true, message: 'photos 元素不能为 undefined/null' })
  photos?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  primary_nose_id?: string;
}

export class UpdateAnimalDto extends PartialType(CreateAnimalDto) {}
