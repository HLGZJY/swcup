import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @ApiProperty({ enum: ['report', 'rescue', 'medical', 'adopt', 'transfer', 'release'] })
  @IsString()
  @IsNotEmpty()
  event_type: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nose_vector_id?: string;

  @ApiProperty()
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

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  location_lat: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  location_lng: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  photos?: string[];
}