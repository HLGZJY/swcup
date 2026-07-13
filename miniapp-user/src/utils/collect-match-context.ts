export const COLLECT_MATCH_CONTEXT_KEY = 'collect_match_context_v1'

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeCandidate(value: any) {
  if (!value || typeof value !== 'object') return null
  const animalId = typeof value.animal_id === 'string' ? value.animal_id : ''
  if (!animalId) return null
  const scores = value.scores && typeof value.scores === 'object'
    ? value.scores
    : {}
  const photos = Array.isArray(value.photos)
    ? value.photos.filter(
        (photo: unknown) => typeof photo === 'string' && photo,
      )
    : []

  return {
    animal_id: animalId,
    breed: typeof value.breed === 'string' ? value.breed : '',
    color: typeof value.color === 'string' ? value.color : '',
    gender: typeof value.gender === 'string' ? value.gender : 'unknown',
    status: typeof value.status === 'string' ? value.status : 'found',
    photos: [...photos],
    address: typeof value.address === 'string' ? value.address : '',
    fusion_score: finiteNumber(value.fusion_score) ?? 0,
    scores: {
      image_similarity: null,
      gps_similarity: finiteNumber(scores.gps_similarity) ?? 0,
      text_match_rate: finiteNumber(scores.text_match_rate) ?? 0,
      time_score: finiteNumber(scores.time_score) ?? 0,
    },
    distance_m: finiteNumber(value.distance_m),
    is_recommended: Boolean(value.is_recommended),
  }
}

export function createCollectMatchContext(data: any) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : []
  return {
    event_id: typeof data?.event_id === 'string' ? data.event_id : null,
    next_action: typeof data?.next_action === 'string' ? data.next_action : '',
    candidates: candidates
      .map(normalizeCandidate)
      .filter((candidate) => candidate !== null),
  }
}

export function createAttributeCompareResult(
  context: any,
  expectedAction: string,
) {
  const validContext = context
    && context.next_action === expectedAction
    && Array.isArray(context.candidates)
  const candidates = validContext ? context.candidates : []
  const results = candidates.reduce((items: any[], value: any) => {
    const candidate = normalizeCandidate(value)
    if (!candidate) return items
    return [
      ...items,
      {
        animal_id: candidate.animal_id,
        vector_id: null,
        fusion_score: candidate.fusion_score,
        vector_similarity: null,
        gps_distance_m: candidate.distance_m,
        gps_similarity: candidate.scores.gps_similarity,
        text_match_rate: candidate.scores.text_match_rate,
        time_score: candidate.scores.time_score,
        image_similarity: null,
        is_recommended: candidate.is_recommended,
        is_orphan: false,
        animal: {
          animal_id: candidate.animal_id,
          breed: candidate.breed,
          color: candidate.color,
          gender: candidate.gender,
          status: candidate.status,
          address: candidate.address,
          photos: [...candidate.photos],
        },
      },
    ]
  }, [])

  return {
    total: results.length,
    results,
    next_action: expectedAction,
    candidate: results[0] || null,
  }
}
