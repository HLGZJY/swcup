// 文本匹配算法 - 独立模块,便于 jest 单元测试
// Bug修复 (2026-06-13): 严格相等匹配, 拒绝子串误匹配
// 起因: 之前用 u.includes(d) || d.includes(u) 会导致 'female'.includes('male') → true

export interface TextMatchField {
  key: 'breed' | 'color' | 'size' | 'coat_length' | 'ear_type' | 'tail_type' | 'gender'
  weight: number
}

// 文本匹配加权字段表 (合计 1.0)
// 设计原则: 身体特征 (color/size/coat/ear/tail) 共 0.80, breed 仅 0.10, gender 0.10
// 因为狗种类用户填得不一致(柴犬/土狗/秋田), 身体特征更可靠
export const TEXT_MATCH_WEIGHTS: TextMatchField[] = [
  { key: 'color',       weight: 0.20 },
  { key: 'size',        weight: 0.20 },
  { key: 'coat_length', weight: 0.15 },
  { key: 'ear_type',    weight: 0.15 },
  { key: 'tail_type',   weight: 0.10 },
  { key: 'gender',      weight: 0.10 },
  { key: 'breed',       weight: 0.10 },
]

// 把 'unknown'/''/'null'/'undefined' 等无意义值归一为 null, 避免污染分母
export function normalizeField(v: any): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s || s === 'unknown' || s === 'null' || s === 'undefined') return null
  return s
}

export function textMatch(dto: any, animal: any): number {
  let matched = 0
  let totalWeight = 0
  for (const { key, weight } of TEXT_MATCH_WEIGHTS) {
    const u = normalizeField(dto?.[key])
    const d = normalizeField(animal?.[key])
    // 任一缺失则跳过(不计入分子也不计入分母, 不惩罚)
    if (!u || !d) continue
    totalWeight += weight
    // 严格相等匹配 - 见文件头注释
    if (u === d) {
      matched += weight
    }
  }
  // 没有可对比字段 → 返回中性值 1, 避免融合分被拉成 0
  if (totalWeight === 0) return 1
  return parseFloat((matched / totalWeight).toFixed(4))
}
