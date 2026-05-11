/**
 * Mock 数据服务 - 鼻纹智救 管理端
 */

// ============ 动物档案 Mock ============
export const mockAnimals = [
  {
    animal_id: 'a001', status: 'lost', species: 'dog', breed: '中华田园犬',
    color: '黄白相间', gender: 'male', age_estimate: 'adult', health_status: 'healthy',
    sterilized: false, first_seen_at: '2026-05-01T10:00:00Z', last_seen_at: '2026-05-10T15:30:00Z',
    location_lat: 39.9042, location_lng: 116.4074, address: '北京市朝阳区建外SOHO',
    notes: '比较亲人，左耳有缺口', tags: ['亲人', '走失'], primary_nose_id: 'v001',
    created_at: '2026-05-01T10:00:00Z', photos: []
  },
  {
    animal_id: 'a002', status: 'found', species: 'dog', breed: '柴犬',
    color: '橙黄', gender: 'male', age_estimate: 'adult', health_status: 'healthy',
    sterilized: true, first_seen_at: '2026-05-03T08:00:00Z', last_seen_at: '2026-05-09T12:00:00Z',
    location_lat: 39.9142, location_lng: 116.4174, address: '北京市朝阳区国贸CBD',
    notes: '戴着红色项圈', tags: ['家养'], primary_nose_id: 'v002',
    created_at: '2026-05-03T08:00:00Z', photos: []
  },
  {
    animal_id: 'a003', status: 'claimed', species: 'dog', breed: '拉布拉多',
    color: '黑色', gender: 'female', age_estimate: 'puppy', health_status: 'healthy',
    sterilized: false, first_seen_at: '2026-05-05T14:00:00Z', last_seen_at: '2026-05-10T18:00:00Z',
    location_lat: 39.8942, location_lng: 116.3974, address: '北京市朝阳区三里屯',
    notes: '很乖，疑似走失', tags: ['走失'], primary_nose_id: 'v003',
    created_at: '2026-05-05T14:00:00Z', photos: []
  }
]

// ============ 事件 Mock ============
export const mockEvents = [
  {
    event_id: 'e001', animal_id: 'a001', event_type: 'report', reporter_id: 'u001',
    occurred_at: '2026-05-10T15:30:00Z', location_lat: 39.9042, location_lng: 116.4074,
    address: '北京市朝阳区建外SOHO', photos: [], nose_photo_url: '',
    description: '发现时正在觅食，比较亲人',
    is_duplicate: false, fusion_score: null, status: 'pending', created_at: '2026-05-10T15:35:00Z'
  },
  {
    event_id: 'e002', animal_id: 'a003', event_type: 'report', reporter_id: 'u002',
    occurred_at: '2026-05-09T18:00:00Z', location_lat: 39.8942, location_lng: 116.3974,
    address: '北京市朝阳区三里屯', photos: [], nose_photo_url: '',
    description: '黑色拉布拉多犬，疑似走失',
    is_duplicate: false, fusion_score: 0.91, status: 'confirmed', created_at: '2026-05-09T18:10:00Z'
  },
  {
    event_id: 'e003', animal_id: 'a002', event_type: 'rescue', reporter_id: 'u003',
    occurred_at: '2026-05-08T10:00:00Z', location_lat: 39.9142, location_lng: 116.4174,
    address: '北京市朝阳区国贸CBD', photos: [], nose_photo_url: '',
    description: '受伤柴犬，已送医',
    is_duplicate: false, fusion_score: null, status: 'resolved', created_at: '2026-05-08T10:10:00Z'
  }
]

// ============ 认领 Mock ============
export const mockClaims = [
  {
    claim_id: 'c001', animal_id: 'a003', event_id: 'e002', user_id: 'u002',
    notes: '这是我家的狗，有项圈照片证明',
    status: 'pending', created_at: '2026-05-10T16:00:00Z',
    user: { user_id: 'u002', nickname: '李四', phone: '139****1234' },
    animal: mockAnimals[2]
  }
]

// ============ 用户 Mock ============
export const mockUsers = [
  { user_id: 'u001', nickname: '张三', phone: '138****8000', role: 'user', created_at: '2026-04-01T00:00:00Z' },
  { user_id: 'u002', nickname: '李四', phone: '139****1234', role: 'user', created_at: '2026-04-05T00:00:00Z' },
  { user_id: 'u003', nickname: '王五', phone: '137****5678', role: 'admin', created_at: '2026-03-20T00:00:00Z' }
]

// ============ 统计数据 Mock ============
export const mockStats = {
  totalAnimals: 156,
  lostAnimals: 42,
  foundAnimals: 38,
  claimedAnimals: 12,
  pendingEvents: 8,
  pendingClaims: 3,
  todayReports: 5
}

// ============ API 函数 ============

export function mockGetStats() {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, data: mockStats }), 400)
  })
}

export function mockGetAdminEvents(params = {}) {
  return new Promise(resolve => {
    setTimeout(() => {
      let list = [...mockEvents]
      if (params.status) {
        list = list.filter(e => e.status === params.status)
      }
      resolve({ code: 0, data: { total: list.length, list } })
    }, 400)
  })
}

export function mockGetAdminClaims(params = {}) {
  return new Promise(resolve => {
    setTimeout(() => {
      let list = [...mockClaims]
      if (params.status) {
        list = list.filter(c => c.status === params.status)
      }
      resolve({ code: 0, data: { total: list.length, list } })
    }, 400)
  })
}

export function mockConfirmEvent(eventId) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, message: '已确认重复' }), 500)
  })
}

export function mockRejectEvent(eventId) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, message: '已驳回' }), 500)
  })
}

export function mockApproveClaim(claimId) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, message: '认领已批准' }), 500)
  })
}

export function mockRejectClaim(claimId) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, message: '认领已驳回' }), 500)
  })
}

export function mockGetAnimals(params = {}) {
  return new Promise(resolve => {
    setTimeout(() => {
      let list = [...mockAnimals]
      if (params.species) list = list.filter(a => a.species === params.species)
      if (params.status) list = list.filter(a => a.status === params.status)
      resolve({ code: 0, data: { total: list.length, list } })
    }, 400)
  })
}

export function mockUpdateAnimal(animalId, data) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, message: '更新成功' }), 500)
  })
}

export function mockGetUsers() {
  return new Promise(resolve => {
    setTimeout(() => resolve({ code: 0, data: { total: mockUsers.length, list: mockUsers } }), 400)
  })
}
