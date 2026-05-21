import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAnimalDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'dog' })
  @IsOptional()
  @IsString()
  species?: string;

  @ApiPropertyOptional({ example: 'lost' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '柴犬' })
  @IsOptional()
  @IsString()
  keyword?: string;
}