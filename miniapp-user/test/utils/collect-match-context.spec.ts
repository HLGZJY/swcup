import { describe, expect, it } from 'vitest'
import {
  COLLECT_MATCH_CONTEXT_KEY,
  createAttributeCompareResult,
  createCollectMatchContext,
} from '@/utils/collect-match-context'

const rawCandidate = {
  animal_id: 'animal-1',
  breed: '金毛',
  color: '金色',
  gender: 'male',
  status: 'lost',
  photos: ['/static/uploads/golden.jpg'],
  address: '武汉市洪山区',
  fusion_score: 0.86,
  scores: {
    image_similarity: null,
    gps_similarity: 0.9,
    text_match_rate: 0.7,
    time_score: 0.6,
  },
  distance_m: 320,
  is_recommended: true,
}

describe('collect match context', () => {
  it('使用版本化且唯一的 storage key', () => {
    expect(COLLECT_MATCH_CONTEXT_KEY).toBe('collect_match_context_v1')
  })

  it('将后端平面候选不可变映射为结果页结构', () => {
    const context = createCollectMatchContext({
      event_id: 'event-1',
      next_action: 'show_high_score_dialog',
      candidates: [rawCandidate],
    })
    const result = createAttributeCompareResult(
      context,
      'show_high_score_dialog',
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({
      animal_id: 'animal-1',
      fusion_score: 0.86,
      vector_similarity: null,
      gps_distance_m: 320,
      gps_similarity: 0.9,
      text_match_rate: 0.7,
      time_score: 0.6,
      animal: {
        animal_id: 'animal-1',
        breed: '金毛',
        photos: ['/static/uploads/golden.jpg'],
      },
    })
    expect(result.results[0]).not.toBe(rawCandidate)
    expect(result.results[0].animal.photos).not.toBe(rawCandidate.photos)
  })

  it('拒绝 action 不一致或结构无效的旧上下文', () => {
    const context = createCollectMatchContext({
      next_action: 'show_high_score_dialog',
      candidates: [rawCandidate, null, { animal_id: '' }],
    })

    expect(
      createAttributeCompareResult(context, 'show_low_score_dialog').results,
    ).toEqual([])
    expect(createAttributeCompareResult(null, 'show_high_score_dialog').results)
      .toEqual([])
  })

  it('将非有限分数归一为 0，不接受非字符串照片', () => {
    const context = createCollectMatchContext({
      next_action: 'show_high_score_dialog',
      candidates: [{
        ...rawCandidate,
        fusion_score: 'not-a-number',
        photos: ['/static/uploads/ok.jpg', null, 42],
        scores: null,
      }],
    })
    const result = createAttributeCompareResult(
      context,
      'show_high_score_dialog',
    )

    expect(result.results[0].fusion_score).toBe(0)
    expect(result.results[0].gps_similarity).toBe(0)
    expect(result.results[0].animal.photos).toEqual(['/static/uploads/ok.jpg'])
  })
})
