import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnimalDto {
  @ApiProperty({ enum: ['cat', 'dog', 'other'] })
  @IsString()
  @IsNotEmpty()
  species: string;

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
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  photos?: string[];
}

export class UpdateAnimalDto extends CreateAnimalDto {}