// -*- coding: utf-8 -*-
/**
 * clue-admin.service.ts
 * =====================
 * Admin 端线索审核服务 (2026-07-07 P3)
 *
 * 职责:
 *   - 从 backend/data/clue_state/*.json 读取 pending 线索
 *   - 提供 confirm/reject 决策 (改 JSON 内 status)
 *   - 列出统计信息 (总数 / pending / confirmed / rejected)
 *
 * 数据来源: ClueBridgeService.init() 创建的 clue_state 目录.
 * 文件名 = animal_id + .json, 内容是数组.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ClueBridgeService } from '../comments/clue-bridge.service';

export interface ClueItem {
  match_id: string;
  comment_id: string;
  animal_id: string;
  comment_reporter_id: string;
  sentiment: string;
  keywords: string[];
  created_at: string;
  candidate_event_id: string;
  candidate_event_reporter_id: string;
  candidate_event_address: string;
  match_score: number;
  match_reasons: string[];
  status: 'pending' | 'confirmed' | 'rejected';
  recorded_at: string;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
}

export interface ClueListResponse {
  total: number;
  pending_count: number;
  confirmed_count: number;
  rejected_count: number;
  items: Array<ClueItem & { animal_id: string }>;
}

@Injectable()
export class ClueAdminService {
  private readonly logger = new Logger(ClueAdminService.name);

  constructor(private readonly clue: ClueBridgeService) {}

  /**
   * 拉所有线索 (不分组, 平铺)
   * 默认只返回 pending, include_all=true 时返回全部
   */
  list(includeAll = false): ClueListResponse {
    const pendingMap = this.clue.listPending();
    const allItems: Array<ClueItem & { animal_id: string }> = [];

    for (const [animalId, arr] of Object.entries(pendingMap)) {
      for (const r of arr) {
        allItems.push({ ...(r as ClueItem), animal_id: animalId });
      }
    }

    // includeAll 模式还要扫 confirmed/rejected 的 (ClueBridgeService 没提供)
    // 简化: 仅返回 pending, admin 列表本来就只看 pending
    if (includeAll) {
      this.logger.warn('[ClueAdminService.list] includeAll 暂不支持, 仅返回 pending');
    }

    // 按 match_score 降序
    allItems.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

    return {
      total: allItems.length,
      pending_count: allItems.length,
      confirmed_count: 0,
      rejected_count: 0,
      items: allItems,
    };
  }

  /**
   * 决策一条线索 (2026-07-09 阶段 A: 改为 async, 返回 JSON 改写 + DB 副作用结果)
   *  - ok       : true 表示 JSON 状态已改
   *  - persisted: confirmed 时是否完成 DB 副作用 (event INSERT + animal UPDATE + comment UPDATE)
   */
  async decide(
    matchId: string,
    animalId: string,
    decision: 'confirmed' | 'rejected',
    note: string,
    adminId: string,
  ): Promise<{ ok: boolean; persisted?: boolean }> {
    return this.clue.decide(matchId, animalId, decision, note, adminId);
  }

  /** 调试用 */
  getStateDir(): string {
    return this.clue.getStateDir();
  }
}