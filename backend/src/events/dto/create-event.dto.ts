import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiProperty({ enum: ['report', 'rescue', 'medical', 'adopt', 'transfer', 'release'] })
  @IsString()
  @IsNotEmpty()
  event_type: string;

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

  @ApiProperty({ description: '纬度，不能为0' })
  @IsNumber()
  @IsNotEmpty()
  @IsValidCoordinate()
  @Type(() => Number)
  location_lat: number;

  @ApiProperty({ description: '经度，不能为0' })
  @IsNumber()
  @IsNotEmpty()
  @IsValidCoordinate()
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