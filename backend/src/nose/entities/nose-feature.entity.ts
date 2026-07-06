import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Animal } from '../../animals/entities/animal.entity';

@Entity('nose_features')
export class NoseFeature {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'vector_id' })
  vector_id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'animal_id' })
  animal_id: string;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'animal_id' })
  animal: Animal;

  @Column({ type: 'text', name: 'feature_vector' })
  feature_vector: Buffer;

  @Column({ type: 'int', default: 512, name: 'vector_dimension' })
  vector_dimension: number;

  @Column({ type: 'varchar', length: 255, name: 'nose_photo_url' })
  nose_photo_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'body_photo_url' })
  body_photo_url: string;

  @Column({ type: 'json', nullable: true, name: 'landmark_data' })
  landmark_data: any;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'confidence_score' })
  confidence_score: number;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  is_primary: boolean;

  @Column({
    type: 'enum',
    enum: ['front', 'left', 'right', 'top'],
    default: 'front',
    name: 'collection_angle',
  })
  collection_angle: string;

  @Column({ type: 'varchar', length: 50, name: 'model_version' })
  model_version: string;

  @Column({ type: 'boolean', default: false, name: 'liveness_check_passed' })
  liveness_check_passed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}