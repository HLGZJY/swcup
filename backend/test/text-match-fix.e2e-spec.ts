/**
 * textMatch 算法回归测试
 *
 * 锁定关键行为: 严格相等匹配, 拒绝子串误匹配
 * 起因: 2026-06-13 Phase 1 调查发现 'female'.includes('male') → true,
 *       导致改用户填的 gender 字段对 text_sim 几乎无影响
 *       (因为 'female' includes 'male' 和 'female' includes 'female' 都是 true)
 */
import { textMatch, TEXT_MATCH_WEIGHTS } from '../src/nose/nose-text-match';

describe('textMatch algorithm regression', () => {
  const dtoFull = {
    color: '棕色',
    gender: 'male',
    breed: '土狗',
    size: 'medium',
    coat_length: 'short',
    ear_type: 'erect',
    tail_type: 'curled',
  };

  it('rejects substring false positive: female must not match male', () => {
    // 这是核心 bug 修复 - 之前 'female'.includes('male') → true
    const score = textMatch({ gender: 'male' }, { gender: 'female' });
    expect(score).toBe(0);
  });

  it('rejects substring false positive: 黄白 must not match 白', () => {
    const score = textMatch({ color: '白' }, { color: '黄白' });
    expect(score).toBe(0);
  });

  it('rejects substring false positive: 棕色 must not match 棕', () => {
    const score = textMatch({ color: '棕' }, { color: '棕色' });
    expect(score).toBe(0);
  });

  it('returns 1 when gender exact match and all other fields empty on both sides', () => {
    // 仅 gender 都填且 match → 应得 1.0 (totalWeight=0.10, matched=0.10)
    const score = textMatch({ gender: 'male' }, { gender: 'male' });
    expect(score).toBe(1);
  });

  it('returns 0 when gender mismatch even if everything else is empty on both sides', () => {
    const score = textMatch({ gender: 'male' }, { gender: 'female' });
    expect(score).toBe(0);
  });

  it('skips fields where either side is null/undefined/empty/unknown', () => {
    // dto.color + animal.color 都为空 → skip
    // dto.gender=male vs animal.gender=male → match
    const score = textMatch(
      { color: '', gender: 'male' },
      { color: undefined, gender: 'male' },
    );
    expect(score).toBe(1);
  });

  it('returns 1 (neutral) when no comparable fields on either side', () => {
    const score = textMatch({}, {});
    expect(score).toBe(1);
  });

  it('weighted score reflects relative weight of matched fields', () => {
    // dto: color=棕色(0.20), gender=male(0.10) → total=0.30
    // animal: color=棕色 match (0.20), gender=female miss
    // → matched=0.20, score=0.20/0.30=0.6667
    const score = textMatch(
      { color: '棕色', gender: 'male' },
      { color: '棕色', gender: 'female' },
    );
    expect(score).toBeCloseTo(0.6667, 3);
  });

  it('changing only gender produces different score (the user-reported bug)', () => {
    const a1 = { breed: '吉娃娃', color: '黄白', gender: 'female' };
    const a2 = { breed: '吉娃娃', color: '黄白', gender: 'male' };
    const s1 = textMatch(dtoFull, a1);  // gender 不 match
    const s2 = textMatch(dtoFull, a2);  // gender match
    expect(s1).not.toBe(s2);
    expect(s2).toBeGreaterThan(s1);
  });

  it('TEXT_MATCH_WEIGHTS sums to 1.0', () => {
    const sum = TEXT_MATCH_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });
});
