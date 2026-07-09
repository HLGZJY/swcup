import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Animal, Gender } from '../../animals/entities/animal.entity';

export enum EventType {
  COLLECT = 'collect',
  REPORT = 'report',
  RESCUE = 'rescue',
  MEDICAL = 'medical',
  ADOPT = 'adopt',
  TRANSFER = 'transfer',
  RELEASE = 'release',
}

export enum EventStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DUPLICATED = 'duplicated',
  LINKED = 'linked',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
}

// 【2026-07-09】区分事件来源,使审核/统计/匹配可按 source 过滤
//   COLLECT         : 用户走采集页且成功提取鼻纹
//   REPORT          : 用户走"我看到"上报事件
//   COLLECT_NO_NOSE : 采集页无鼻纹(走后端 image 比对 + 用户确认)
//   USER_CREATE     : 用户主动从结果页"同意新建"
//   SIGHTING        : 二次目击(POST /animals/:id/sightings 端点不入审核流,但写一份事件留痕)
//   CLAIM           : 认领流程产生的事件
//   CLUE            : 阶段 A — 线索审核 confirmed 时,落一条 rescue_event 留痕
//   ADMIN           : admin 后台手动创建
export enum EventSource {
  COLLECT = 'collect',
  REPORT = 'report',
  COLLECT_NO_NOSE = 'collect_no_nose',
  USER_CREATE = 'user_create',
  SIGHTING = 'sighting',
  CLAIM = 'claim',
  CLUE = 'clue',
  ADMIN = 'admin',
}

@Entity('rescue_events')
export class RescueEvent {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'event_id' })
  event_id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'animal_id' })
  animal_id: string;

  @ManyToOne(() => Animal)
  @JoinColumn({ name: 'animal_id' })
  animal: Animal;

  @Column({ type: 'enum', enum: EventType, name: 'event_type' })
  event_type: EventType;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'reporter_id' })
  reporter_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'station_id' })
  station_id: string;

  @Column({ type: 'datetime', name: 'occurred_at' })
  occurred_at: Date;

  @Column({ type: 'decimal', precision: 10, scale: 8, name: 'location_lat' })
  location_lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, name: 'location_lng' })
  location_lng: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'json', nullable: true })
  photos: string[];

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'nose_photo_url' })
  nose_photo_url: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'nose_vector_id' })
  nose_vector_id: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true, name: 'action_taken' })
  action_taken: string;

  @Column({ type: 'boolean', default: false, name: 'is_duplicate' })
  is_duplicate: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'duplicate_of' })
  duplicate_of: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'fusion_score' })
  fusion_score: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'vector_similarity' })
  vector_similarity: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'gps_similarity' })
  gps_similarity: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'image_similarity' })
  image_similarity: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'text_match_rate' })
  text_match_rate: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'time_score' })
  time_score: number;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ type: 'json', nullable: true })
  candidates: any[];

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'species' })
  species: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'breed' })
  breed: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'color' })
  color: string;

  @Column({ type: 'json', nullable: true, name: 'body_colors' })
  body_colors: any[] | null;

  @Column({ type: 'enum', enum: Gender, nullable: true, name: 'gender' })
  gender: Gender;

  // 【Defect 4 / 2026-07-08】intent 持久化 — 之前 dto.intent 只在 create 时用来驱动自动建档,不入库
  //   导致 admin 后审 createAnimalFromEvent 拿不到 intent,默认 status=lost 错误
  //   现在持久化后,createAnimalFromEvent 读 event.intent 透传给 AnimalsService.create
  //   intent='found' 时再额外生成一条 lost 记录
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'intent' })
  intent: string;

  // 【2026-07-09】事件来源 — 区分采集/上报/无鼻纹采集/二次目击/认领/admin
  @Column({
    type: 'enum',
    enum: EventSource,
    default: EventSource.COLLECT,
    name: 'source',
  })
  source: EventSource;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
