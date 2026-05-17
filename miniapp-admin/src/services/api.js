/**
 * 鼻纹智救 - 管理端 API 服务
 * 后端地址：http://192.168.32.1:3000
 * 所有接口均需 admin role
 */

const BASE_URL = 'http://192.168.32.1:3000'

// ============ 管理端接口（需认证+admin）============

/**
 * 获取管理端统计
 * GET /admin/stats
 * 响应: { totalAnimals, lostAnimals, foundAnimals, claimedAnimals, pendingEvents, pendingClaims, todayReports, todayResolved, todayProcessing }
 */
export function apiGetStats() {
  return request('/admin/stats')
}

/**
 * 获取动物列表（管理）
 * GET /admin/animals?page=1&limit=20&status=lost
 */
export function apiGetAdminAnimals(params = {}) {
  console.log('[API-FN] apiGetAdminAnimals called, params=', JSON.stringify(params))
  return request('/admin/animals', { params })
}

/**
 * 获取动物详情（管理）
 * GET /admin/animals/:animal_id
 */
export function apiGetAdminAnimalDetail(animalId) {
  return request(`/admin/animals/${animalId}`)
}

/**
 * 新增动物
 * POST /admin/animals
 * 请求: { status, species, breed, color, gender, age_estimate, health_status, sterilized, first_seen_at, last_seen_at, location_lat, location_lng, address, notes }
 */
export function apiCreateAnimal(params) {
  return request('/admin/animals', {
    method: 'POST',
    body: params
  })
}

/**
 * 更新动物
 * PUT /admin/animals/:animal_id
 * 请求: { status, notes }  —— 可只传这两个字段
 * 重要：批准认领后需调此接口把 status 改为 claimed
 */
export function apiUpdateAnimal(animalId, params) {
  return request(`/admin/animals/${animalId}`, {
    method: 'PUT',
    body: params
  })
}

/**
 * 删除动物
 * DELETE /admin/animals/:animal_id
 * 会级联删除鼻纹和事件
 */
export function apiDeleteAnimal(animalId) {
  return request(`/admin/animals/${animalId}`, {
    method: 'DELETE'
  })
}

/**
 * 获取事件列表（管理）
 * GET /admin/events?page=1&limit=20&status=pending
 */
export function apiGetAdminEvents(params = {}) {
  console.log('[API-FN] apiGetAdminEvents called')
  return request('/admin/events', { params })
}

/**
 * 获取事件详情（管理）
 * GET /admin/events/:event_id
 */
export function apiGetAdminEventDetail(eventId) {
  return request(`/admin/events/${eventId}`)
}

/**
 * AI 处理事件
 * POST /admin/events/:event_id/process
 */
export function apiProcessEvent(eventId) {
  return request(`/admin/events/${eventId}/process`, {
    method: 'POST'
  })
}

/**
 * 确认重复事件
 * PUT /admin/events/:event_id/confirm
 */
export function apiConfirmEvent(eventId) {
  return request(`/admin/events/${eventId}/confirm`, {
    method: 'PUT'
  })
}

/**
 * 驳回事件
 * PUT /admin/events/:event_id/reject
 */
export function apiRejectEvent(eventId) {
  return request(`/admin/events/${eventId}/reject`, {
    method: 'PUT'
  })
}

/**
 * 获取认领申请列表（管理）
 * GET /admin/claims?page=1&limit=20&status=pending
 */
export function apiGetAdminClaims(params = {}) {
  return request('/admin/claims', { params })
}

/**
 * 获取认领详情（管理）
 * GET /admin/claims/:claim_id
 */
export function apiGetAdminClaimDetail(claimId) {
  return request(`/admin/claims/${claimId}`)
}

/**
 * 批准认领
 * PUT /admin/claims/:claim_id/approve
 * 注意：不会自动更新 animals.status，需额外调 apiUpdateAnimal(animalId, { status: 'claimed' })
 */
export function apiApproveClaim(claimId) {
  return request(`/admin/claims/${claimId}/approve`, {
    method: 'PUT'
  })
}

/**
 * 拒绝认领
 * PUT /admin/claims/:claim_id/reject
 */
export function apiRejectClaim(claimId) {
  return request(`/admin/claims/${claimId}/reject`, {
    method: 'PUT'
  })
}

/**
 * 获取用户列表
 * GET /admin/users
 */
export function apiGetAdminUsers() {
  return request('/admin/users')
}

/**
 * 获取用户信息
 * GET /users/me
 */
export function apiGetCurrentUser() {
  return request('/users/me')
}

// ============ 内部工具函数 ============

function request(path, options = {}) {
  const { needAuth = true } = { needAuth: true }
  const { method = 'GET', params = {}, body = {} } = options

  return new Promise((resolve, reject) => {
    console.log('[API-PROMISE] Promise created for path=', path)
    setTimeout(() => {
      console.log('[API-TIMEOUT] still pending after 5s, path=', path)
    }, 5000)
let fullPath = path
    if (Object.keys(params).length > 0) {
      // 手动拼接 query string，避免小程序端 URLSearchParams 兼容性问题
      const query = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
      fullPath = `${path}?${query}`
    }

    const header = {}
    const token = uni.getStorageSync('token')

    if (needAuth) {
      if (token) {
        header['Authorization'] = 'Bearer ' + token
      }
    }

    // DEBUG: 打印请求信息
    console.log('[API]', method, BASE_URL + fullPath, 'token=', token ? token.slice(0, 20) + '...' : 'EMPTY')

    // 入口日志：确认 request 函数被调用了
    console.log('[API>>] request called, path=', path, 'options=', JSON.stringify(options))

    uni.request({
      url: BASE_URL + fullPath,
      method,
      header,
      data: body,
      success: (res) => {
        // DEBUG: 打印响应
        console.log('[API] response', JSON.stringify(res.data)?.slice(0, 300))

        // HTTP 状态码非 2xx → 视为网络/服务器错误
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let msg = '请求失败'
          if (res.statusCode === 401) msg = '登录已过期，请重新登录'
          else if (res.statusCode === 403) msg = '无权限访问'
          else if (res.statusCode === 500) msg = '服务器异常'
          uni.showToast({ title: msg, icon: 'none' })
          // 401 也要清除 token 并跳转
          if (res.statusCode === 401) {
            uni.removeStorageSync('token')
            uni.removeStorageSync('user_info')
            setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 1500)
          }
          reject(res)
          return
        }

        const data = res.data
        // data 不是合法 JSON 对象
        if (!data || typeof data !== 'object') {
          uni.showToast({ title: '响应格式异常', icon: 'none' })
          reject(res)
          return
        }

        // 认证错误 → 跳转登录
        if (data.code === 40101 || data.code === 40102) {
          uni.removeStorageSync('token')
          uni.removeStorageSync('user_info')
          uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/login/login' })
          }, 1500)
          reject(data)
          return
        }

        // 无管理员权限
        if (data.code === 40303) {
          uni.showToast({ title: '无管理员权限', icon: 'none' })
          reject(data)
          return
        }

        // AI 识别失败
        if (data.code === 50002 || data.code === 50003) {
          uni.showToast({ title: 'AI识别失败，请稍后重试', icon: 'none' })
          reject(data)
          return
        }

        // 其他业务错误
        if (data.code !== 0) {
          uni.showToast({ title: data.message || '请求失败', icon: 'none' })
          reject(data)
          return
        }

        // 兼容：后端 list 类接口双层包装 {code,data:{code,data:{list/total}}}
        // 判断依据：data.data 本身也是标准响应结构（含有 code 字段）
        let unwrapped = data
        if (data.data && typeof data.data === 'object' && 'code' in data.data) {
          const inner = data.data
          unwrapped = {
            code: inner.code,
            message: inner.message,
            data: inner.data
          }
        }

        resolve(unwrapped)
      },
      fail: (err) => {
        uni.showToast({ title: '网络异常，请检查网络', icon: 'none' })
        reject(err)
      }
    })
  })
}
