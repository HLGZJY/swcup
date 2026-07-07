// -*- coding: utf-8 -*-
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ format: 'uuid', example: 'a001' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  animal_id: string;

  @ApiProperty({ example: '我刚在朝阳公园看到一只', minLength: 1, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  content: string;
}