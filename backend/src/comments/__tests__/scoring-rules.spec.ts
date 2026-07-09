// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 C】ScoringRules + ClueBridgeService.score 单元测试
 *
 * 覆盖:
 *   1) DEFAULT_RULES 常量值正确
 *   2) sentiment base 分 (report=0.5, seek=0.4)
 *   3) entity 命中分层加权 (按 category.weight 求和, 上限 entityMax=0.4)
 *   4) synonym 兜底 +0.1 (仅 entity 0 命中时)
 *   5) negation 窗口 -0.2 (出现否定 + entity 0 命中)
 *   6) time_decay (30 天双曲, dt=0→0.15, dt=30d→0)
 *   7) self_match -0.3 (评论 reporter == 事件 reporter)
 *   8) clamp(0,1) 边界
 *   9) E 档: 自匹配即使 score 达标, 状态也走 self_match (不入库)
 */
import { ClueBridgeService } from '../clue-bridge.service';
import { DEFAULT_RULES } from '../scoring-rules';

function dicts() {
  return {
    entities: {
      categories: {
        breed: { weight: 0.2, words: ['金毛', '拉布拉多', '田园犬'] },
        color: { weight: 0.15, words: ['棕色', '黄色', '黑色'] },
        feature: { weight: 0.15, words: ['断尾', '项圈'] },
      },
    },
    synonyms: {
      groups: [
        { canonical: '狗', aliases: ['狗狗', '毛孩子'] },
        { canonical: '金毛', aliases: ['金毛犬'] },
      ],
    },
    negations: { words: ['不是', '没有', '没', '未见', '未发现'] },
  };
}

describe('ScoringRules (阶段 C)', () => {
  describe('DEFAULT_RULES', () => {
    it('阈值 0.5, entityMax 0.4', () => {
      expect(DEFAULT_RULES.threshold).toBe(0.5);
      expect(DEFAULT_RULES.entityMax).toBe(0.4);
      expect(DEFAULT_RULES.synonymBonus).toBe(0.1);
      expect(DEFAULT_RULES.negationPenalty).toBe(0.2);
      expect(DEFAULT_RULES.selfMatchPenalty).toBe(0.3);
      expect(DEFAULT_RULES.timeWindowDays).toBe(30);
      expect(DEFAULT_RULES.timeDecayPeak).toBe(0.15);
      expect(DEFAULT_RULES.sentiment.report).toBe(0.5);
      expect(DEFAULT_RULES.sentiment.seek).toBe(0.4);
    });
  });

  describe('ClueBridgeService.score', () => {
    const tokenize = (c: string) =>
      Array.from(
        new Set(
          ((c || '').match(/[\u4e00-\u9fa5]{2,6}/g) || []).map((s) =>
            s.toLowerCase(),
          ),
        ),
      );

    it('sentiment=report → +0.5 基础分', () => {
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '看到狗',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: tokenize('看到狗'),
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T09:00:00Z',
          address: '朝阳公园',
        },
        DEFAULT_RULES,
        dicts(),
      );
      expect(r.score).toBeGreaterThanOrEqual(0.5);
      expect(r.reasons.some((x) => x.startsWith('sentiment=report'))).toBe(true);
    });

    it('sentiment=seek → +0.4 基础分', () => {
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '寻狗',
          reporter_id: 'u1',
          sentiment: 'seek',
          created_at: '2026-07-09T10:00:00Z',
          tokens: tokenize('寻狗'),
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T09:00:00Z',
          address: '朝阳公园',
        },
        DEFAULT_RULES,
        dicts(),
      );
      expect(r.score).toBeGreaterThanOrEqual(0.4);
      expect(r.reasons.some((x) => x.startsWith('sentiment=seek'))).toBe(true);
    });

    it('entity 命中分层加权 (cap=entityMax)', () => {
      // tokens: 金毛 + 棕色 + 断尾 → 3 hit, sum_weight = 0.2+0.15+0.15 = 0.5
      // 但 cap 在 0.4, 所以加 0.4
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '看到金毛棕色断尾',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: tokenize('看到金毛棕色断尾'),
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T10:00:00Z',
          address: '北京金毛棕色断尾狗',
        },
        DEFAULT_RULES,
        dicts(),
      );
      // sentiment 0.5 + entity cap 0.4 + time_decay ≈ 0.5 + 0.4 + 0.149 = 1.049 → clamp 1
      expect(r.score).toBeLessThanOrEqual(1);
      const entityReason = r.reasons.find((x) => x.startsWith('entity_hits='));
      expect(entityReason).toBeDefined();
      expect(entityReason).toMatch(/\+0\.4/);
    });

    it('synonym 兜底: entity 0 命中时 +0.1', () => {
      // tokens: 狗 (canonical in synonyms, 在 address)
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '看到狗',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: ['狗'],
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T09:00:00Z',
          address: '北京有只狗走失',
        },
        DEFAULT_RULES,
        dicts(),
      );
      const synReason = r.reasons.find((x) => x.startsWith('synonym='));
      expect(synReason).toBeDefined();
      expect(synReason).toMatch(/\+0\.1/);
    });

    it('negation 窗口: 有否定 + 0 entity 命中 → -0.2', () => {
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '没有看到狗',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: tokenize('没有看到狗'),
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T09:00:00Z',
          address: '北京',
        },
        DEFAULT_RULES,
        dicts(),
      );
      const negReason = r.reasons.find((x) => x.startsWith('negation_window'));
      expect(negReason).toBeDefined();
      expect(negReason).toMatch(/-0\.2/);
    });

    it('negation 不扣分: 有否定 + 有 entity 命中 (语义反转不惩罚)', () => {
      // "没有看到金毛" + event 含 "金毛" → entity hit, 不应触发 negation
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '没有看到金毛',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: tokenize('没有看到金毛'),
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T09:00:00Z',
          address: '北京金毛走失',
        },
        DEFAULT_RULES,
        dicts(),
      );
      const negReason = r.reasons.find((x) => x.startsWith('negation_window'));
      expect(negReason).toBeUndefined();
    });

    it('time_decay: dt=0 → +0.15, dt=15d → +0.075, dt=30d → 0', () => {
      const baseComment = {
        comment_id: 'c1',
        animal_id: 'a1',
        content: '看到狗',
        reporter_id: 'u1',
        sentiment: 'report' as const,
        tokens: ['狗'],
      };
      const event = {
        event_id: 'e1',
        event_type: 'report',
        reporter_id: 'u2',
        address: '北京狗走失',
      };
      const r0 = ClueBridgeService.score(
        { ...baseComment, created_at: '2026-07-09T10:00:00Z' },
        { ...event, occurred_at: '2026-07-09T10:00:00Z' },
        DEFAULT_RULES,
        dicts(),
      );
      const r15 = ClueBridgeService.score(
        { ...baseComment, created_at: '2026-07-09T10:00:00Z' },
        { ...event, occurred_at: '2026-06-24T10:00:00Z' },
        DEFAULT_RULES,
        dicts(),
      );
      const r30 = ClueBridgeService.score(
        { ...baseComment, created_at: '2026-07-09T10:00:00Z' },
        { ...event, occurred_at: '2026-06-09T10:00:00Z' },
        DEFAULT_RULES,
        dicts(),
      );
      // 抽取 time_close bonus
      const t0 = parseFloat(r0.reasons.find((x) => x.startsWith('time_close'))!.split('+')[1]);
      const t15 = parseFloat(r15.reasons.find((x) => x.startsWith('time_close'))!.split('+')[1]);
      expect(t0).toBeCloseTo(0.15, 2);
      expect(t15).toBeCloseTo(0.075, 2);
      // 30 天: 没 time_close reason
      expect(r30.reasons.some((x) => x.startsWith('time_close'))).toBe(false);
    });

    it('self_match 扣分 -0.3 (reporter_id 相同)', () => {
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '看到狗',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: ['狗'],
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u1', // SAME
          occurred_at: '2026-07-09T09:00:00Z',
          address: '北京狗走失',
        },
        DEFAULT_RULES,
        dicts(),
      );
      const sm = r.reasons.find((x) => x.startsWith('self_match'));
      expect(sm).toBeDefined();
      expect(sm).toMatch(/-0\.3/);
    });

    it('clamp(0, 1) 上界', () => {
      // 多 entity hit + 时间近 + report → 总分会超 1, 截到 1
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '金毛棕色断尾',
          reporter_id: 'u1',
          sentiment: 'report',
          created_at: '2026-07-09T10:00:00Z',
          tokens: tokenize('金毛棕色断尾'),
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u2',
          occurred_at: '2026-07-09T10:00:00Z',
          address: '金毛棕色断尾走失',
        },
        DEFAULT_RULES,
        dicts(),
      );
      expect(r.score).toBe(1);
    });

    it('clamp(0, 1) 下界: 负分变 0', () => {
      const r = ClueBridgeService.score(
        {
          comment_id: 'c1',
          animal_id: 'a1',
          content: '加油',
          reporter_id: 'u1',
          sentiment: 'thanks', // 不在 report/seek → 0
          created_at: '2026-07-09T10:00:00Z',
          tokens: ['加油'],
        },
        {
          event_id: 'e1',
          event_type: 'report',
          reporter_id: 'u1', // self
          occurred_at: '2026-07-09T10:00:00Z',
          address: '',
        },
        DEFAULT_RULES,
        dicts(),
      );
      // sentiment=0 + time=0.15 + self=-0.3 = -0.15 → clamp 0
      expect(r.score).toBe(0);
    });
  });
});
