import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, IsEnum, IsBoolean, ValidateNested, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, EventSource } from '../entities/event.entity';
import { BodyColorDto } from '../../animals/dto/create-animal.dto';

export function IsValidCoordinate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsValidCoordinate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any): boolean {
          return value !== 0 && !isNaN(value);
        },
        defaultMessage(validationArguments?: ValidationArguments): string {
          return `${validationArguments.property} 不能为0或无效坐标`;
        },
      },
    });
  };
}

export class CreateEventDto {
  @ApiProperty({ enum: EventType, description: 'collect=鼻纹采集流程; report=用户主动上报' })
  @IsEnum(EventType, { message: `event_type 必须是 ${Object.values(EventType).join(', ')} 之一` })
  event_type: EventType;

  @ApiPropertyOptional({
    enum: ['lost', 'found', 'stray_sighting', 'profile_build', 'unknown'],
    description: '阶段 1 (2026-07-06) 事件意图; intent=lost|found + 无 animal_id 自动建档',
  })
  @IsString()
  @IsOptional()
  intent?: string;

  @ApiPropertyOptional({
    enum: EventSource,
    description: '事件来源; 默认 collect。可选: collect/report/collect_no_nose/user_create/sighting/claim/admin',
  })
  @IsEnum(EventSource, { message: `source 必须是 ${Object.values(EventSource).join(', ')} 之一` })
  @IsOptional()
  source?: EventSource;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nose_vector_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nose_photo_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  animal_id?: string;

  @ApiProperty()
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

  @ApiPropertyOptional({ enum: ['junior', 'puppy', 'adult', 'senior', 'unknown'] })
  @IsString()
  @IsOptional()
  age_estimate?: string;

  @ApiPropertyOptional({ enum: ['healthy', 'injured', 'ill', 'sick', 'unknown'] })
  @IsString()
  @IsOptional()
  health_status?: string;

  @ApiPropertyOptional({ description: 'true=已绝育, false=未绝育, null/undefined=用户未填 (Animal 默认 false)' })
  @IsBoolean()
  @IsOptional()
  sterilized?: boolean | null;

  @ApiPropertyOptional({ description: '纬度；缺省/0 时自动从 animal_id 反查' })
  @IsNumber()
  @IsOptional()
  @IsValidCoordinate()
  @Type(() => Number)
  location_lat?: number;

  @ApiPropertyOptional({ description: '经度；缺省/0 时自动从 animal_id 反查' })
  @IsNumber()
  @IsOptional()
  @IsValidCoordinate()
  @Type(() => Number)
  location_lng?: number;

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
