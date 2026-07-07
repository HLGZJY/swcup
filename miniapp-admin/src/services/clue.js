/**
 * 评论线索 API 封装 (P3 2026-07-07)
 * 后端: backend/src/admin/clue-admin.service.ts
 */
import { request } from './api'

/**
 * GET /admin/clues/pending
 */
export function apiGetPendingClues() {
  return request('/admin/clues/pending')
}

/**
 * POST /admin/clues/:animal_id/:match_id/decide
 * body: { decision: 'confirmed' | 'rejected', note?: string }
 */
export function apiDecideClue(animalId, matchId, decision, note) {
  return request(`/admin/clues/${animalId}/${matchId}/decide`, {
    method: 'POST',
    data: { decision, note: note || '' },
  })
}