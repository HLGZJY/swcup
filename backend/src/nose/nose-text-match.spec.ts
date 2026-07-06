import {
  normalizeField,
  textMatch,
  TEXT_MATCH_WEIGHTS,
} from './nose-text-match';

describe('nose-text-match', () => {
  describe('TEXT_MATCH_WEIGHTS', () => {
    it('权重总和应为 1.0', () => {
      const total = TEXT_MATCH_WEIGHTS.reduce((sum, f) => sum + f.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it('应包含身体特征字段(weight > 0) — color/size/coat_length/ear_type/tail_type', () => {
      const keys = TEXT_MATCH_WEIGHTS.map(f => f.key);
      expect(keys).toContain('color');
      expect(keys).toContain('size');
      expect(keys).toContain('coat_length');
      expect(keys).toContain('ear_type');
      expect(keys).toContain('tail_type');
    });

    it('身体特征权重视应大于 breed 权重(身体特征更可靠)', () => {
      const bodyKeys = ['color', 'size', 'coat_length', 'ear_type', 'tail_type'];
      const bodyWeight = TEXT_MATCH_WEIGHTS
        .filter(f => bodyKeys.includes(f.key))
        .reduce((s, f) => s + f.weight, 0);
      const breedField = TEXT_MATCH_WEIGHTS.find(f => f.key === 'breed');
      expect(bodyWeight).toBeGreaterThan(breedField!.weight);
    });
  });

  describe('normalizeField', () => {
    it('null 应归一为 null', () => {
      expect(normalizeField(null)).toBeNull();
    });

    it('undefined 应归一为 null', () => {
      expect(normalizeField(undefined)).toBeNull();
    });

    it('空字符串应归一为 null', () => {
      expect(normalizeField('')).toBeNull();
    });

    it('"unknown" 应归一为 null', () => {
      expect(normalizeField('unknown')).toBeNull();
    });

    it('"null" 应归一为 null', () => {
      expect(normalizeField('null')).toBeNull();
    });

    it('"undefined" 应归一为 null', () => {
      expect(normalizeField('undefined')).toBeNull();
    });

    it('前后空白的 "  yellow  " 应归一为 "yellow"', () => {
      expect(normalizeField('  yellow  ')).toBe('yellow');
    });

    it('数字应转字符串', () => {
      expect(normalizeField(123)).toBe('123');
    });

    it('正常字符串应原样返回(去除空白)', () => {
      expect(normalizeField('shiba_inu')).toBe('shiba_inu');
    });
  });

  describe('textMatch - 严格相等匹配', () => {
    it('全部字段匹配应返回 1.0', () => {
      const dto = { breed: 'shiba', color: 'yellow', size: 'medium', coat_length: 'short', ear_type: 'erect', tail_type: 'curled', gender: 'male' };
      const animal = { ...dto };
      expect(textMatch(dto, animal)).toBe(1.0);
    });

    it('全部字段不匹配应返回 0', () => {
      const dto = { breed: 'shiba', color: 'yellow', size: 'medium', coat_length: 'short', ear_type: 'erect', tail_type: 'curled', gender: 'male' };
      const animal = { breed: 'poodle', color: 'white', size: 'small', coat_length: 'long', ear_type: 'floppy', tail_type: 'long', gender: 'female' };
      expect(textMatch(dto, animal)).toBe(0);
    });

    it('部分字段匹配应返回对应加权比例', () => {
      // 7 字段, color+size+coat_length 一致 (0.2+0.2+0.15=0.55)
      // totalWeight=1.0, matched=0.55 → 0.55
      const dto = { breed: 'shiba', color: 'yellow', size: 'medium', coat_length: 'short', ear_type: 'erect', tail_type: 'curled', gender: 'male' };
      const animal = { breed: 'poodle', color: 'yellow', size: 'medium', coat_length: 'short', ear_type: 'floppy', tail_type: 'long', gender: 'female' };
      expect(textMatch(dto, animal)).toBe(0.55);
    });

    it('【回归:Bug2026-06-13】female 不应被 male 子串误匹配', () => {
      // 旧实现用 includes 会把 'female'.includes('male') 当 true
      // 新实现严格相等: gender=male vs gender=female → 不匹配
      const dto = { gender: 'male' };
      const animal = { gender: 'female' };
      expect(textMatch(dto, animal)).toBe(0);
    });

    it('【回归:Bug2026-06-13】shiba 不应被 shiba_inu 子串误匹配', () => {
      const dto = { breed: 'shiba' };
      const animal = { breed: 'shiba_inu' };
      expect(textMatch(dto, animal)).toBe(0);
    });
  });

  describe('textMatch - 缺失字段处理', () => {
    it('dto 全空,animal 全空 → 没有可对比字段 → 返回 0(BUG-008 修复后不再给中性值 1)', () => {
      expect(textMatch({}, {})).toBe(0);
    });

    it('dto 缺字段,animal 有字段 → 跳过该字段(不计入分母)', () => {
      const dto = { color: 'yellow' };
      const animal = { color: 'yellow', size: 'medium', breed: 'shiba' };
      // 只对比 color (weight=0.20), 完全匹配 → 1.0
      expect(textMatch(dto, animal)).toBe(1.0);
    });

    it('dto 有字段,animal 缺字段 → 跳过该字段(不计入分母)', () => {
      const dto = { color: 'yellow', breed: 'shiba' };
      const animal = { color: 'yellow' };
      // 只对比 color (weight=0.20), 完全匹配 → 1.0
      expect(textMatch(dto, animal)).toBe(1.0);
    });

    it('unknown 值不应被纳入分母', () => {
      const dto = { color: 'yellow', breed: 'unknown' };
      const animal = { color: 'yellow', breed: 'shiba' };
      // breed 都是非空但 unknown 归一为 null → 不计入分母
      // 只对比 color (weight=0.20), 完全匹配 → 1.0
      expect(textMatch(dto, animal)).toBe(1.0);
    });

    it('animal 为 null 时不应抛错(兜底)', () => {
      const dto = { color: 'yellow' };
      // @ts-expect-error 测试 null 兜底
      expect(textMatch(dto, null)).toBe(0);
    });

    it('dto 为 null 时不应抛错(兜底)', () => {
      // @ts-expect-error 测试 null 兜底
      expect(textMatch(null, { color: 'yellow' })).toBe(0);
    });
  });

  describe('textMatch - 精度', () => {
    it('返回值最多 4 位小数', () => {
      const dto = { color: 'yellow', size: 'medium' };
      const animal = { color: 'yellow', size: 'medium' };
      const result = textMatch(dto, animal);
      // 1.0 或其字符串最多 4 位小数
      expect(String(result).split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
    });
  });

  describe('textMatch - 【回归 BUG-008】文本匹配度不应被默认为 1', () => {
    // 用户实测: 拉布拉多 vs 金毛 → text_match_rate=1.0 (BUG)
    // 修复后: 不应给中性值 1;按字段加权计算

    it('【回归】拉布拉多 vs 金毛 (仅 breed 不同, color/gender 相同) → 不应等于 1.0', () => {
      const dto = { breed: '拉布拉多', color: '黄色', gender: 'male' };
      const animal = { breed: '金毛', color: '黄色', gender: 'male' };
      const score = textMatch(dto, animal);
      // color(0.20) + gender(0.10) = 0.30; breed(0.10) 不匹配 → 0.30 / 0.40 = 0.75
      expect(score).toBe(0.75);
      expect(score).not.toBe(1);
    });

    it('【回归】完全不相关的字段 (dog vs cat, 颜色不同, 性别不同) → 应接近 0', () => {
      const dto = { breed: '拉布拉多', color: '黄色', gender: 'male' };
      const animal = { breed: '萨摩耶', color: '白色', gender: 'female' };
      const score = textMatch(dto, animal);
      // 全部不匹配 → 0
      expect(score).toBe(0);
      expect(score).not.toBe(1);
    });

    it('【回归】dto 全空 animal 有字段 → 返回 0(旧逻辑给 1 会误判完美匹配)', () => {
      // 旧逻辑:textMatch({}, {color:'黄色', breed:'金毛'}) → 返回 1
      // 新逻辑:应该返回 0,因为没有可对比字段
      const score = textMatch({}, { color: '黄色', breed: '金毛' });
      expect(score).toBe(0);
    });
  });
});