// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 C】线索评分规则常量
 *
 * 设计目标: 把分散在 clue-bridge.service.ts 的魔法数字收敛到一处,
 * 后续 (阶段 D) 可从 JSON 加载, 本阶段先以 TS 常量形式提供。
 *
 * 公式 (clue-bridge._score 使用):
 *   score = sentiment_base        // 0.5 (report) / 0.4 (seek)
 *         + entity_weighted_sum   // 按 entities.categories[name].weight 求和, 上限 entityMax
 *         + (entity_hits==0 ? synonym_bonus : 0)
 *         - (negation_hit && entity_hits==0 ? negation_penalty : 0)
 *         + time_decay_bonus      // 30 天双曲, 7 天≈0.15, 30 天=0
 *         - (reporter_id==event.reporter_id ? self_match_penalty : 0)
 *   final = clamp(0, 1, score)
 *
 * 阈值: match_score >= threshold 才进 pending, 否则 no_match
 */
export interface ScoringRules {
  /** sentiment 触发后的基础分 */
  sentiment: { report: number; seek: number };
  /** 实体词命中分层加权后的最大累计加成 */
  entityMax: number;
  /** 实体未命中时, 同义词兜底加分 */
  synonymBonus: number;
  /** 否定词窗口命中 + 实体未命中 时的扣分 */
  negationPenalty: number;
  /** 评论 reporter == 事件 reporter 时的扣分 */
  selfMatchPenalty: number;
  /** 时间衰减窗口 (天), 超过此天数 time_bonus=0 */
  timeWindowDays: number;
  /** 时间衰减峰值 (在 t=0 时加成, 之后双曲下降) */
  timeDecayPeak: number;
  /** match_score >= threshold 才生成 pending 线索 */
  threshold: number;
}

export const DEFAULT_RULES: ScoringRules = {
  sentiment: { report: 0.5, seek: 0.4 },
  entityMax: 0.4,
  synonymBonus: 0.1,
  negationPenalty: 0.2,
  selfMatchPenalty: 0.3,
  timeWindowDays: 30,
  timeDecayPeak: 0.15,
  threshold: 0.5,
};

/** 兼容旧 API: 直接从 DEFAULT_RULES 取阈值 */
export const CLUE_THRESHOLD = DEFAULT_RULES.threshold;
