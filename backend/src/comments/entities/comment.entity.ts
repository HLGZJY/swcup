// -*- coding: utf-8 -*-
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Animal } from '../../animals/entities/animal.entity';
import { User } from '../../users/entities/user.entity';

export enum CommentSentiment {
  CARE = 'care',
  SEEK = 'seek',
  FAKE = 'fake',
  THANKS = 'thanks',
  REPORT = 'report',
  NEUTRAL = 'neutral',
}

@Entity('comments')
@Index('idx_comments_animal_created', ['animal_id', 'created_at'])
@Index('idx_comments_animal_visible', ['animal_id', 'is_hidden'])
export class Comment {
  @PrimaryColumn({ type: 'char', length: 36, name: 'comment_id' })
  comment_id: string;

  @Column({ type: 'char', length: 36, name: 'animal_id' })
  animal_id: string;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'animal_id' })
  animal: Animal;

  @Column({ type: 'char', length: 36, name: 'reporter_id' })
  reporter_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: CommentSentiment,
    default: CommentSentiment.NEUTRAL,
  })
  sentiment: CommentSentiment;

  @Column({ type: 'boolean', default: false, name: 'is_hidden' })
  is_hidden: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}