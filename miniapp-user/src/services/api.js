/**
 * 鼻纹智救 - 用户端 API 服务
 * 后端地址：http://127.0.0.1:3000
 * 所有需认证接口自动携带 Authorization: Bearer <token>
 */

const BASE_URL = 'http://127.0.0.1:3000'

/**
 * 解析图片完整 URL
 * - http:// 开头 → 直接返回
 * - /static/mock/ 开头 → 本地静态资源，返回原路径
 * - 其他以 / 开头 → 拼上 BASE_URL
 * - 字面字符串 "undefined"/"null" 视为空值（防御历史脏数据导致 /v1undefined 404）
 */
export function resolveImageUrl(path) {
  if (!path) return ''
  if (path === 'undefined' || path === 'null') return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/static/mock/')) return path
  return BASE_URL + path
}

// ============ 认证相关 ============

/**
 * 登录
 * POST /auth/login
 * 请求: { phone, password }
 * 响应: { token, user: { user_id, nickname, phone, role, ... } }
 */
export function apiLogin(phone, password) {
  return request('/v1/auth/login', {
    method: 'POST',
    body: { phone, password }
  }, { needAuth: false })
}

/**
 * 注册
 * POST /auth/register
 * 请求: { phone, password, nickname }
 */
export function apiRegister(phone, password) {
  return request('/v1/auth/register', {
    method: 'POST',
    body: { phone, password }
  }, { needAuth: false })
}

/**
 * 微信授权登录
 * POST /auth/weixin
 * 请求: { code: wx.login() 返回的登录凭证 }
 */
export function apiWeixinLogin(code) {
  return request('/v1/auth/weixin', {
    method: 'POST',
    body: { code }
  }, { needAuth: false })
}

// ============ 动物档案（公开）============

/**
 * 获取动物列表
 * GET /v1/animals?page=1&limit=10&status=lost
 */
export function apiGetAnimals(params = {}) {
  return request('/v1/animals', { params }, { needAuth: false })
}

/**
 * 获取动物详情
 * GET /v1/animals/:animal_id
 */
export function apiGetAnimalDetail(animalId) {
  return request(`/v1/animals/${animalId}`, {}, { needAuth: false })
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
  return request('/v1/nose/collect', {
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
  return request('/v1/nose/compare', {
    method: 'POST',
    body: params
  }, { needAuth: false })
}

/**
 * AI 品种分类（全身照）
 * POST /v1/nose/classify
 * 请求: { image: "data:image/jpeg;base64,..." }
 */
export function apiClassifyBreed(params) {
  return request('/v1/nose/classify', { method: 'POST', body: params }, { needAuth: false })
}

// ============ 用户私有接口（需认证）============

/**
 * 获取当前用户信息
 * GET /users/me
 */
export function apiGetCurrentUser() {
  return request('/v1/users/me')
}

/**
 * 更新当前用户信息
 * PATCH /users/me
 * 请求: { nickname, role }
 */
export function apiUpdateCurrentUser(params) {
  return request('/v1/users/me', {
    method: 'PATCH',
    body: params
  })
}

/**
 * 上报救助事件
 * POST /events
 * 请求: { event_type, species, gender, age_estimate, health_status, sterilized, color, breed, notes, first_seen_at, last_seen_at, location_lat, location_lng, address, tags, photos }
 */
export function apiReportEvent(params) {
  return request('/v1/events', {
    method: 'POST',
    body: params
  })
}

/**
 * 获取我的上报事件
 * GET /events/my
 */
export function apiGetMyEvents() {
  return request('/v1/events/my')
}

/**
 * 获取我的认领记录
 * GET /claims/my
 */
export function apiGetMyClaims() {
  return request('/v1/claims/my')
}

/**
 * 发起认领
 * POST /claims
 * 请求: { animal_id, event_id, notes, contact_method, contact_value }
 */
export function apiSubmitClaim(params) {
  return request('/v1/claims', {
    method: 'POST',
    body: params
  })
}

/**
 * 发送验证码
 * POST /auth/send-code
 * 请求: { phone }
 */
export function apiSendCode(phone) {
  return request('/v1/auth/send-code', {
    method: 'POST',
    body: { phone }
  }, { needAuth: false })
}

/**
 * 绑定手机号
 * POST /auth/bind-phone
 * 请求: { phone, code, password }
 */
export function apiBindPhone(phone, code, password) {
  return request('/v1/auth/bind-phone', {
    method: 'POST',
    body: { phone, code, password }
  })
}

/**
 * 忘记密码重置
 * POST /auth/reset-password
 * 请求: { phone, code, password }
 */
export function apiResetPassword(phone, code, password) {
  return request('/v1/auth/reset-password', {
    method: 'POST',
    body: { phone, code, password }
  }, { needAuth: false })
}

/**
 * 创建动物档案（Plan B）
 * POST /v2/animals
 * 请求: { species, breed, color, gender, age_estimate, health_status, location_lat, location_lng, address, notes }
 */
export function apiCreateAnimal(params) {
  return request('/v2/animals', {
    method: 'POST',
    body: params
  })
}

/**
 * 上传文件
 * POST /v1/upload
 * 用于采集流程中上传全身照和鼻纹照
 */
export function apiUploadFile(tempFilePath) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    const header = {}
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }

    uni.uploadFile({
      url: BASE_URL + '/v1/upload',
      filePath: tempFilePath,
      name: 'file',
      header,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          uni.showToast({ title: '上传失败', icon: 'none' })
          reject(res)
          return
        }
        try {
          const data = JSON.parse(res.data)
          // 后端 TransformInterceptor 把响应包装为 {code,message,data:{url}}
          // 同时兼容直接返回 {url} 的旧响应形态
          const url = data?.data?.url ?? data?.url
          if (typeof url !== 'string' || !url) {
            uni.showToast({ title: '上传响应格式异常', icon: 'none' })
            reject(new Error('upload: missing url in response'))
            return
          }
          resolve(url)
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络异常，上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

// ============ 内部工具函数 ============

/**
 * 把后端 message 字段（可能是字符串、字符串数组、对象）归一为可读字符串
 */
function formatBackendError(msg) {
  if (!msg) return ''
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) return msg.filter(Boolean).map(String).join('；')
  if (typeof msg === 'object') {
    try { return JSON.stringify(msg) } catch { return String(msg) }
  }
  return String(msg)
}

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
          // 401 走专用流程
          if (res.statusCode === 401) {
            uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
            uni.removeStorageSync('token')
            uni.removeStorageSync('user_info')
            setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 1500)
            reject(res)
            return
          }

          // 4xx 优先透传后端 message（可能是字符串或字符串数组）
          const detail = formatBackendError(res.data?.message) || (res.statusCode === 403 ? '无权限访问' : res.statusCode === 500 ? '服务器异常' : '请求失败')
          // 短用 toast，长用 modal 保证可读
          if (detail.length <= 18) {
            uni.showToast({ title: detail, icon: 'none' })
          } else {
            uni.showModal({ title: res.statusCode === 500 ? '服务器异常' : '请求被拒绝', content: detail, showCancel: false, confirmText: '我知道了' })
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
