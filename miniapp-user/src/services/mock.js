/**
 * Mock 数据服务 - 鼻纹智救
 * 所有 API 使用本地 Mock 数据，不依赖后端
 */

// ============ 动物档案 Mock ============
export const mockAnimals = [
  {
    animal_id: 'a001',
    status: 'lost',
    species: 'dog',
    breed: '中华田园犬',
    color: '黄白相间',
    gender: 'male',
    age_estimate: 'adult',
    health_status: 'healthy',
    sterilized: false,
    first_seen_at: '2026-05-01T10:00:00Z',
    last_seen_at: '2026-05-10T15:30:00Z',
    location_lat: 39.9042,
    location_lng: 116.4074,
    address: '北京市朝阳区建外SOHO',
    notes: '比较亲人，未绝育，左耳有缺口',
    tags: ['亲人', '走失', '已挂牌'],
    primary_nose_id: 'v001',
    created_at: '2026-05-01T10:00:00Z',
    photos: ['/static/mock/dog-placeholder.png']
  },
  {
    animal_id: 'a002',
    status: 'lost',
    species: 'dog',
    breed: '柴犬',
    color: '橙黄',
    gender: 'male',
    age_estimate: 'adult',
    health_status: 'healthy',
    sterilized: true,
    first_seen_at: '2026-05-03T08:00:00Z',
    last_seen_at: '2026-05-09T12:00:00Z',
    location_lat: 39.9142,
    location_lng: 116.4174,
    address: '北京市朝阳区国贸CBD',
    notes: '戴着红色项圈，有狗牌',
    tags: ['家养', '走失'],
    primary_nose_id: 'v002',
    created_at: '2026-05-03T08:00:00Z',
    photos: ['/static/mock/dog-placeholder.png']
  },
  {
    animal_id: 'a003',
    status: 'found',
    species: 'dog',
    breed: '拉布拉多',
    color: '黑色',
    gender: 'female',
    age_estimate: 'puppy',
    health_status: 'healthy',
    sterilized: false,
    first_seen_at: '2026-05-05T14:00:00Z',
    last_seen_at: '2026-05-10T18:00:00Z',
    location_lat: 39.8942,
    location_lng: 116.3974,
    address: '北京市朝阳区三里屯',
    notes: '黑色拉布拉多，很乖，疑似走失',
    tags: ['走失', '黑色'],
    primary_nose_id: 'v003',
    created_at: '2026-05-05T14:00:00Z',
    photos: ['/static/mock/dog-placeholder.png']
  },
  {
    animal_id: 'a004',
    status: 'lost',
    species: 'cat',
    breed: '狸花猫',
    color: '灰黑条纹',
    gender: 'male',
    age_estimate: 'adult',
    health_status: 'healthy',
    sterilized: true,
    first_seen_at: '2026-05-06T20:00:00Z',
    last_seen_at: '2026-05-09T22:00:00Z',
    location_lat: 39.9242,
    location_lng: 116.4274,
    address: '北京市朝阳区望京',
    notes: '夜间活动，警觉性高',
    tags: ['亲人', '绝育'],
    primary_nose_id: 'v004',
    created_at: '2026-05-06T20:00:00Z',
    photos: ['/static/mock/cat-placeholder.png']
  },
  {
    animal_id: 'a005',
    status: 'claimed',
    species: 'dog',
    breed: '柯基',
    color: '黄白',
    gender: 'female',
    age_estimate: 'adult',
    health_status: 'healthy',
    sterilized: true,
    first_seen_at: '2026-04-28T09:00:00Z',
    last_seen_at: '2026-05-08T11:00:00Z',
    location_lat: 39.9342,
    location_lng: 116.4374,
    address: '北京市朝阳区亚运村',
    notes: '短腿柯基，性格活泼',
    tags: ['家养', '已认领'],
    primary_nose_id: 'v005',
    created_at: '2026-04-28T09:00:00Z',
    photos: ['/static/mock/dog-placeholder.png']
  }
]

// ============ 救助事件 Mock ============
export const mockEvents = [
  {
    event_id: 'e001',
    animal_id: 'a001',
    event_type: 'report',
    reporter_id: 'u001',
    station_id: null,
    occurred_at: '2026-05-10T15:30:00Z',
    location_lat: 39.9042,
    location_lng: 116.4074,
    address: '北京市朝阳区建外SOHO',
    photos: [],
    nose_photo_url: '/static/mock/nose-guide.png',
    description: '发现时正在觅食，比较亲人，左耳有缺口',
    action_taken: null,
    is_duplicate: false,
    duplicate_of: null,
    fusion_score: null,
    status: 'pending',
    created_at: '2026-05-10T15:35:00Z'
  },
  {
    event_id: 'e002',
    animal_id: 'a003',
    event_type: 'report',
    reporter_id: 'u002',
    station_id: null,
    occurred_at: '2026-05-09T18:00:00Z',
    location_lat: 39.8942,
    location_lng: 116.3974,
    address: '北京市朝阳区三里屯',
    photos: [],
    nose_photo_url: '/static/mock/nose-guide.png',
    description: '黑色拉布拉多犬，疑似走失，很乖',
    action_taken: null,
    is_duplicate: false,
    duplicate_of: null,
    fusion_score: null,
    status: 'confirmed',
    created_at: '2026-05-09T18:10:00Z'
  }
]

// ============ 比对结果 Mock ============
// 用正确公式验算：
// S_location = max(0, 1-(d-500)/1000)
// fusion = 0.40*vector + 0.20*S_location + 0.20*image + 0.20*text
// a001: 320m → S_loc=1.0 → 0.40*0.95+0.20*1.0+0.20*0.88+0.20*0.80 = 0.91 ✓
// a002: 1250m → S_loc=0.25 → 0.40*0.89+0.20*0.25+0.20*0.79+0.20*0.72 = 0.71
// a003: 2100m → S_loc=0 → 0.40*0.82+0.20*0+0.20*0.71+0.20*0.68 = 0.63
export const mockCompareResults = {
  total: 3,
  results: [
    {
      animal_id: 'a001',
      fusion_score: 0.91,
      vector_similarity: 0.95,
      gps_distance_m: 320,
      image_similarity: 0.88,
      text_match_rate: 0.80,
      animal: mockAnimals[0]
    },
    {
      animal_id: 'a002',
      fusion_score: 0.71,
      vector_similarity: 0.89,
      gps_distance_m: 1250,
      image_similarity: 0.79,
      text_match_rate: 0.72,
      animal: mockAnimals[1]
    },
    {
      animal_id: 'a003',
      fusion_score: 0.63,
      vector_similarity: 0.82,
      gps_distance_m: 2100,
      image_similarity: 0.71,
      text_match_rate: 0.68,
      animal: mockAnimals[2]
    }
  ],
  threshold_confirmed: 0.88,
  threshold_suspected: 0.75
}

// ============ 用户 Mock ============
export const mockUser = {
  user_id: 'u001',
  nickname: '爱心市民',
  phone: '138****8000',
  avatar_url: '/static/mock/avatar-default.png',
  role: 'user',
  created_at: '2026-04-01T00:00:00Z'
}

// ============ 认领记录 Mock ============
export const mockClaims = [
  {
    claim_id: 'c001',
    animal_id: 'a001',
    event_id: 'e001',
    user_id: 'u001',
    notes: '这是我家走丢的狗，有项圈照片证明',
    status: 'pending',
    created_at: '2026-05-10T16:00:00Z'
  }
]

// ============ API 模拟函数 ============

/**
 * 鼻纹采集
 * 真实请求：{ nose_photo(base64), species, location_lat, location_lng, description }
 */
export function mockNoseCollect(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: '采集成功',
        data: {
          vector_id: 'v' + Date.now(),
          confidence_score: 0.92,
          liveness_passed: true
        }
      })
    }, 800)
  })
}

/**
 * 鼻纹比对
 */
export function mockNoseCompare(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: '比对完成',
        data: mockCompareResults
      })
    }, 1500)
  })
}

/**
 * 获取动物列表
 */
export function mockGetAnimals(params = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let list = [...mockAnimals]
      if (params.species) {
        list = list.filter(a => a.species === params.species)
      }
      if (params.status) {
        list = list.filter(a => a.status === params.status)
      }
      resolve({
        code: 0,
        message: 'success',
        data: {
          total: list.length,
          list
        }
      })
    }, 500)
  })
}

/**
 * 获取动物详情
 */
export function mockGetAnimalDetail(animalId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const animal = mockAnimals.find(a => a.animal_id === animalId)
      if (animal) {
        resolve({
          code: 0,
          message: 'success',
          data: animal
        })
      } else {
        resolve({
          code: 404,
          message: 'Animal not found',
          data: null
        })
      }
    }, 300)
  })
}

/**
 * 上报救助事件
 */
export function mockReportEvent(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: '事件上报成功',
        data: {
          event_id: 'e' + Date.now(),
          is_duplicate: false,
          fusion_score: null,
          status: 'pending'
        }
      })
    }, 1000)
  })
}

/**
 * 提交认领申请
 * 真实请求：{ animal_id, event_id, notes }
 */
export function mockSubmitClaim(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: '认领申请已提交',
        data: {
          claim_id: 'c' + Date.now(),
          status: 'pending'
        }
      })
    }, 800)
  })
}

/**
 * 获取认领记录
 */
export function mockGetClaims() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: 'success',
        data: mockClaims
      })
    }, 400)
  })
}

/**
 * 获取当前用户
 */
export function mockGetCurrentUser() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: 'success',
        data: mockUser
      })
    }, 300)
  })
}

/**
 * 模拟登录（微信登录流程：先 wx.login() 获取 code，再传 code 登录）
 * 真实请求：{ code, nickname, avatar_url }
 */
export function mockLogin(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: '登录成功',
        data: {
          token: 'mock_jwt_token_' + Date.now(),
          user: mockUser
        }
      })
    }, 600)
  })
}
