import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { NoseFeature } from '../../nose/entities/nose-feature.entity';

export enum AnimalStatus {
  LOST = 'lost',
  FOUND = 'found',
  CLAIMED = 'claimed',
  ARCHIVED = 'archived',
}

export enum Species {
  CAT = 'cat',
  DOG = 'dog',
  OTHER = 'other',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  UNKNOWN = 'unknown',
}

export enum AgeEstimate {
  PUPPY = 'puppy',
  ADULT = 'adult',
  SENIOR = 'senior',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  INJURED = 'injured',
  ILL = 'ill',
  UNKNOWN = 'unknown',
}

@Entity('animals')
export class Animal {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'animal_id' })
  animal_id: string;

  @Column({
    type: 'enum',
    enum: AnimalStatus,
    default: AnimalStatus.LOST,
  })
  status: AnimalStatus;

  @Column({ type: 'enum', enum: Species })
  species: Species;

  @Column({ type: 'varchar', length: 50, nullable: true })
  breed: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.UNKNOWN })
  gender: Gender;

  @Column({ type: 'enum', enum: AgeEstimate, nullable: true, name: 'age_estimate' })
  age_estimate: AgeEstimate;

  @Column({
    type: 'enum',
    enum: HealthStatus,
    default: HealthStatus.UNKNOWN,
    name: 'health_status',
  })
  health_status: HealthStatus;

  @Column({ type: 'boolean', default: false })
  sterilized: boolean;

  @Column({ type: 'datetime', name: 'first_seen_at' })
  first_seen_at: Date;

  @Column({ type: 'datetime', name: 'last_seen_at' })
  last_seen_at: Date;

  @Column({ type: 'decimal', precision: 10, scale: 8, name: 'location_lat' })
  location_lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, name: 'location_lng' })
  location_lng: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'primary_nose_id' })
  primary_nose_id: string;

  @Column({ type: 'json', nullable: true })
  photos: string[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}