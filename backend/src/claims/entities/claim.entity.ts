import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Animal } from '../../animals/entities/animal.entity';
import { RescueEvent } from '../../events/entities/event.entity';

export enum ClaimStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('claims')
export class Claim {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'claim_id' })
  claim_id: string;

  @Column({ type: 'varchar', length: 36, name: 'animal_id' })
  animal_id: string;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'animal_id' })
  animal: Animal;

  @Column({ type: 'varchar', length: 36, name: 'claimer_id' })
  claimer_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'claimer_id' })
  claimer: User;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'event_id' })
  event_id: string;

  @ManyToOne(() => RescueEvent)
  @JoinColumn({ name: 'event_id' })
  event: RescueEvent;

  @Column({ type: 'datetime', name: 'claimed_at' })
  claimed_at: Date;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
    default: ClaimStatus.PENDING,
  })
  status: ClaimStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true, name: 'proof_photos' })
  proof_photos: string[];

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'approved_by' })
  approved_by: string;

  @Column({ type: 'datetime', nullable: true, name: 'approved_at' })
  approved_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}