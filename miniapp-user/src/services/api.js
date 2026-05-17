/**
 * 鼻纹智救 - 用户端 API 服务
 * 后端地址：http://192.168.32.1:3000
 * 所有需认证接口自动携带 Authorization: Bearer <token>
 */

const BASE_URL = 'http://192.168.32.1:3000'

// ============ 认证相关 ============

/**
 * 登录
 * POST /auth/login
 * 请求: { phone, password }
 * 响应: { token, user: { user_id, nickname, phone, role, ... } }
 */
export function apiLogin(phone, password) {
  return request('/auth/login', {
    method: 'POST',
    body: { phone, password }
  }, { needAuth: false })
}

/**
 * 注册
 * POST /auth/register
 * 请求: { phone, password, nickname }
 */
export function apiRegister(phone, password, nickname) {
  return request('/auth/register', {
    method: 'POST',
    body: { phone, password, nickname }
  }, { needAuth: false })
}

// ============ 动物档案（公开）============

/**
 * 获取动物列表
 * GET /animals?page=1&limit=10&status=lost
 */
export function apiGetAnimals(params = {}) {
  return request('/animals', { params }, { needAuth: false })
}

/**
 * 获取动物详情
 * GET /animals/:animal_id
 */
export function apiGetAnimalDetail(animalId) {
  return request(`/animals/${animalId}`, {}, { needAuth: false })
}

// ============ 鼻纹模块（公开）============

/**
 * 鼻纹采集
 * POST /nose/collect
 * 请求: { nose_photo: "data:image/jpeg;base64,...", species, animal_id: null, location_lat, location_lng }
 *鼻纹采集
 * POST /nose/collect
 * 请求: { nose_photo: "data:image/jpeg;base64,...", species, animal_id: null, location_lat, location_lng, device_id, timestamp }
 */
export function apiNoseCollect(params) {
  return request('/nose/collect', {
    method: 'POST',
    body: params
  }, { needAuth: false })
}

/**
 * 鼻纹比对
 * POST /nose/compare
 * 请求: { nose_photo: "data:image/jpeg;base64,...", species, animal_id, location_lat, location_lng }
 * 注意：animal_id 必填，不能为 null
 */
export function apiNoseCompare(params) {
  return request('/nose/compare', {
    method: 'POST',
    body: params
  }, { needAuth: false })
}

// ============ 用户私有接口（需认证）============

/**
 * 获取当前用户信息
 * GET /users/me
 */
export function apiGetCurrentUser() {
  return request('/users/me')
}

/**
 * 上报救助事件
 * POST /events
 * 请求: { event_type, species, gender, age_estimate, health_status, sterilized, color, breed, notes, first_seen_at, last_seen_at, location_lat, location_lng, address, tags, photos }
 */
export function apiReportEvent(params) {
  return request('/events', {
    method: 'POST',
    body: params
  })
}

/**
 * 获取我的上报事件
 * GET /events/my
 */
export function apiGetMyEvents() {
  return request('/events/my')
}

/**
 * 获取我的认领记录
 * GET /claims/my
 */
export function apiGetMyClaims() {
  return request('/claims/my')
}

/**
 * 发起认领
 * POST /claims
 * 请求: { animal_id, event_id, notes, contact_method, contact_value }
 */
export function apiSubmitClaim(params) {
  return request('/claims', {
    method: 'POST',
    body: params
  })
}

// ============ 内部工具函数 ============

/**
 * 统一请求封装
 * @param {string} path - 接口路径，如 /auth/login
 * @param {object} options - uni.request 选项
 * @param {object} opts - { needAuth: true/false }
 */
function request(path, options = {}, opts = {}) {
  const { needAuth = true } = opts
  const { method = 'GET', params = {}, body = {} } = options

  return new Promise((resolve, reject) => {
    // 拼接 query 参数（避免小程序端 URLSearchParams 兼容性问题）
    let fullPath = path
    if (Object.keys(params).length > 0) {
      const query = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
      fullPath = `${path}?${query}`
    }

    const header = {}

    // 自动携带 Token
    if (needAuth) {
      const token = uni.getStorageSync('token')
      if (token) {
        header['Authorization'] = 'Bearer ' + token
      }
    }

    uni.request({
      url: BASE_URL + fullPath,
      method,
      header,
      data: body,
      success: (res) => {
        // HTTP 状态码非 2xx → 视为网络/服务器错误
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let msg = '请求失败'
          if (res.statusCode === 401) msg = '登录已过期，请重新登录'
          else if (res.statusCode === 403) msg = '无权限访问'
          else if (res.statusCode === 500) msg = '服务器异常'
          uni.showToast({ title: msg, icon: 'none' })
          if (res.statusCode === 401) {
            uni.removeStorageSync('token')
            uni.removeStorageSync('user_info')
            setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 1500)
          }
          reject(res)
          return
        }

        const data = res.data
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
        let unwrapped = data
        if (data.data && typeof data.data === 'object' && 'code' in data.data) {
          const inner = data.data
          unwrapped = { code: inner.code, message: inner.message, data: inner.data }
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
