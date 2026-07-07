import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum PendingNoseStatus {
  PENDING = 'pending',
  APPROVED_NEW = 'approved_new',
  APPROVED_DUP = 'approved_dup',
  REJECTED = 'rejected',
}

@Entity('pending_nose_records')
export class PendingNoseRecord {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'record_id' })
  record_id: string;

  @Column({ type: 'varchar', length: 36, name: 'vector_id' })
  vector_id: string;

  @Column({ type: 'varchar', length: 36, name: 'collector_id' })
  collector_id: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'fusion_score' })
  fusion_score: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'vector_similarity' })
  vector_similarity: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'gps_similarity' })
  gps_similarity: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'text_match_rate' })
  text_match_rate: number | null;

  @Column({ type: 'enum', enum: PendingNoseStatus, default: PendingNoseStatus.PENDING })
  status: PendingNoseStatus;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'animal_id' })
  animal_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'reviewed_by' })
  reviewed_by: string | null;

  @Column({ type: 'datetime', nullable: true, name: 'reviewed_at' })
  reviewed_at: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true, name: 'location_lat' })
  location_lat: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true, name: 'location_lng' })
  location_lng: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  breed: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  species: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'nose_photo_url' })
  nose_photo_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'body_photo_url' })
  body_photo_url: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}