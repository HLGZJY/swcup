/**
 * 鼻纹智救 - 管理端 API 服务
 * 后端地址：http://192.168.32.1:3000
 * 所有接口均需 admin role
 */

const BASE_URL = "http://192.168.32.1:3000/v1";

// 静态资源 URL 不走 API versioning (NestJS URI versioning 只对 controller 路由生效)
// ServeStaticModule 实际挂在 /static, 拼成 /v1/static/... 会 404
// 修复: 解析图片 URL 时必须用 STATIC_BASE_URL (无 /v1)
const STATIC_BASE_URL = "http://192.168.32.1:3000";

/**
 * 解析图片完整 URL
 * - http:// 开头 → 直接返回
 * - /static/mock/ 开头 → 本地静态资源，返回原路径
 * - 其他以 / 开头 → 拼上 STATIC_BASE_URL (无 /v1 前缀, 否则 ServeStatic 404)
 * - 字面字符串 "undefined"/"null" 视为空值（防御历史脏数据导致 /v1undefined 404）
 */
export function resolveImageUrl(path) {
  if (!path) return "";
  // 防御:某些历史数据/异常上下游可能传入字符串 "undefined"/"null"
  if (path === "undefined" || path === "null") return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/static/mock/")) return path;
  return STATIC_BASE_URL + path;
}

// ============ 管理端接口（需认证+admin）============

/**
 * 获取管理端统计
 * GET /admin/stats
 * 响应: { totalAnimals, lostAnimals, foundAnimals, claimedAnimals, pendingEvents, pendingClaims, todayReports, todayResolved, todayProcessing }
 */
export function apiGetStats() {
  return request("/admin/stats");
}

/**
 * 获取动物列表（管理）
 * GET /admin/animals?page=1&limit=20&status=lost
 */
export function apiGetAdminAnimals(params = {}) {
  console.log(
    "[API-FN] apiGetAdminAnimals called, params=",
    JSON.stringify(params),
  );
  return request("/admin/animals", { params });
}

/**
 * 获取动物详情（管理）
 * GET /admin/animals/:animal_id
 */
export function apiGetAdminAnimalDetail(animalId) {
  return request(`/admin/animals/${animalId}`);
}

/**
 * 新增动物
 * POST /admin/animals
 * 请求: { status, species, breed, color, gender, age_estimate, health_status, sterilized, first_seen_at, last_seen_at, location_lat, location_lng, address, notes }
 */
export function apiCreateAnimal(params) {
  return request("/admin/animals", {
    method: "POST",
    body: params,
  });
}

/**
 * 更新动物
 * PUT /admin/animals/:animal_id
 * 请求: { status, notes }  —— 可只传这两个字段
 * 重要：批准认领后需调此接口把 status 改为 claimed
 */
export function apiUpdateAnimal(animalId, params) {
  return request(`/admin/animals/${animalId}`, {
    method: "PUT",
    body: params,
  });
}

/**
 * 删除动物
 * DELETE /admin/animals/:animal_id
 * 会级联删除鼻纹和事件
 */
export function apiDeleteAnimal(animalId) {
  return request(`/admin/animals/${animalId}`, {
    method: "DELETE",
  });
}

/**
 * 获取事件列表（管理）
 * GET /admin/events?page=1&limit=20&status=pending
 */
export function apiGetAdminEvents(params = {}) {
  console.log("[API-FN] apiGetAdminEvents called");
  return request("/admin/events", { params });
}

/**
 * 获取事件详情（管理）
 * GET /admin/events/:event_id
 */
export function apiGetAdminEventDetail(eventId) {
  return request(`/admin/events/${eventId}`);
}

/**
 * 获取审核详情（含候选列表）
 * GET /admin/events/:event_id
 * 响应新增: candidates[], vector_similarity, gps_similarity, image_similarity, text_match_rate
 */
export function apiGetAdminAuditDetail(eventId) {
  return request(`/admin/events/${eventId}`);
}

/**
 * AI 处理事件
 * POST /admin/events/:event_id/process
 */
export function apiProcessEvent(eventId) {
  return request(`/admin/events/${eventId}/process`, {
    method: "POST",
  });
}

/**
 * 确认重复事件
 * PUT /admin/events/:event_id/confirm
 * 请求（等后端就绪）: { animal_id: string }  // 合并目标动物ID
 */
export function apiConfirmEvent(eventId, params = {}) {
  return request(`/admin/events/${eventId}/confirm`, {
    method: "PUT",
    body: params,
  });
}

/**
 * 驳回事件
 * PUT /admin/events/:event_id/reject
 */
export function apiRejectEvent(eventId) {
  return request(`/admin/events/${eventId}/reject`, {
    method: "PUT",
  });
}

/**
 * 【Bug 6 / 2026-07-08】admin 从发现页上报事件创建新动物
 * 场景: 发现页上报动物无候选时,admin 需有"创建新动物"入口
 * 后端: eventsService.createAnimalFromEvent(event_id),事件字段 → 新 Animal,event.status=confirmed
 * PUT /admin/events/:event_id/action body={ action: 'create_new' }
 */
export function apiCreateAnimalFromEvent(eventId) {
  return request(`/admin/events/${eventId}/action`, {
    method: "PUT",
    body: { action: "create_new" },
  });
}

/**
 * 【2026-07-09 重构】admin 合并事件到目标动物
 * 区别于 apiCreateAnimalFromEvent:保留旧动物 + 把事件合并到它,event.status=duplicated + is_duplicate=true
 * PUT /admin/events/:event_id/action body={ action: 'merge', animal_id }
 */
export function apiMergeEvent(eventId, animalId) {
  return request(`/admin/events/${eventId}/action`, {
    method: "PUT",
    body: { action: "merge", animal_id: animalId },
  });
}

/**
 * 获取认领申请列表（管理）
 * GET /admin/claims?page=1&limit=20&status=pending
 */
export function apiGetAdminClaims(params = {}) {
  return request("/admin/claims", { params });
}

/**
 * 获取认领详情（管理）
 * GET /admin/claims/:claim_id
 */
export function apiGetAdminClaimDetail(claimId) {
  return request(`/admin/claims/${claimId}`);
}

/**
 * 批准认领
 * PUT /admin/claims/:claim_id/approve
 * 注意：不会自动更新 animals.status，需额外调 apiUpdateAnimal(animalId, { status: 'claimed' })
 */
export function apiApproveClaim(claimId) {
  return request(`/admin/claims/${claimId}/approve`, {
    method: "PUT",
  });
}

/**
 * 拒绝认领
 * PUT /admin/claims/:claim_id/reject
 */
export function apiRejectClaim(claimId) {
  return request(`/admin/claims/${claimId}/reject`, {
    method: "PUT",
  });
}

/**
 * 获取用户列表
 * GET /admin/users
 */
export function apiGetAdminUsers(params = {}) {
  return request("/admin/users", { params });
}

// ============ 待审鼻纹记录 (Defect 1 / 2026-07-08) ============
// 后端已有 GET/POST /admin/pending-nose-records/* 接口,admin UI 必须打通才能让用户主动提交的待审档案流转
// 来源:
//   - LOW_SCORE_NOSE  : collect() 阶段低分鼻纹自动写入
//   - USER_CREATE_REQUEST: 用户在 collect 页点"创建档案"走 /v1/nose/pending-animal-request 写入
// 两条源都进同一张 pending_nose_records 表,admin 在此处统一审核

/**
 * 待审鼻纹记录列表
 * GET /admin/pending-nose-records?status=pending&page=1&limit=20
 * 响应: { total, list: PendingNoseRecord[] }
 */
export function apiGetAdminPendingNoseRecords(params = {}) {
  return request("/admin/pending-nose-records", { params });
}

/**
 * 待审鼻纹详情
 * GET /admin/pending-nose-records/:record_id
 */
export function apiGetAdminPendingNoseDetail(recordId) {
  return request(`/admin/pending-nose-records/${recordId}`);
}

/**
 * 审核通过 — 视为新动物建档
 * POST /admin/pending-nose-records/:record_id/approve-as-new
 * body: 可选覆盖字段 (species/breed/color/gender/address/photos)
 */
export function apiPostAdminPendingNoseApprove(recordId, body = {}) {
  return request(`/admin/pending-nose-records/${recordId}/approve-as-new`, {
    method: "POST",
    body,
  });
}

/**
 * 审核通过 — 视为某已有动物的重复
 * POST /admin/pending-nose-records/:record_id/approve-as-duplicate
 * body: { animal_id: string }
 */
export function apiPostAdminPendingNoseApproveAsDuplicate(recordId, animalId) {
  return request(`/admin/pending-nose-records/${recordId}/approve-as-duplicate`, {
    method: "POST",
    body: { animal_id: animalId },
  });
}

/**
 * 审核驳回
 * POST /admin/pending-nose-records/:record_id/reject
 */
export function apiPostAdminPendingNoseReject(recordId) {
  return request(`/admin/pending-nose-records/${recordId}/reject`, {
    method: "POST",
  });
}

/**
 * 获取用户详情
 * GET /admin/users/:user_id
 */
export function apiGetUserDetail(userId) {
  return request(`/admin/users/${userId}`);
}

/**
 * 获取用户上报事件
 * GET /admin/users/:user_id/events?page=1&limit=20
 */
export function apiGetUserEvents(userId, params = {}) {
  return request(`/admin/users/${userId}/events`, { params });
}

/**
 * 获取用户认领记录
 * GET /admin/users/:user_id/claims?page=1&limit=20
 */
export function apiGetUserClaims(userId, params = {}) {
  return request(`/admin/users/${userId}/claims`, { params });
}

/**
 * 获取用户关联动物
 * GET /admin/users/:user_id/animals?page=1&limit=20
 */
export function apiGetUserAnimals(userId, params = {}) {
  return request(`/admin/users/${userId}/animals`, { params });
}

/**
 * 更新用户信息
 * PUT /admin/users/:user_id
 * 请求: { nickname, phone, email } —— 可只传需要更新的字段
 */
export function apiUpdateUser(userId, data) {
  return request(`/admin/users/${userId}`, {
    method: "PUT",
    body: data,
  });
}

/**
 * 获取用户信息
 * GET /users/me
 */
export function apiGetCurrentUser() {
  return request("/users/me");
}

// ============ 内部工具函数 ============

function request(path, options = {}) {
  const { needAuth = true } = { needAuth: true };
  const { method = "GET", params = {}, body = {} } = options;

  return new Promise((resolve, reject) => {
    console.log("[API-PROMISE] Promise created for path=", path);
    setTimeout(() => {
      console.log("[API-TIMEOUT] still pending after 5s, path=", path);
    }, 5000);
    let fullPath = path;
    if (Object.keys(params).length > 0) {
      // 手动拼接 query string，避免小程序端 URLSearchParams 兼容性问题
      const query = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
        )
        .join("&");
      fullPath = `${path}?${query}`;
    }

    const header = {};
    const token = uni.getStorageSync("token");

    if (needAuth) {
      if (token) {
        header["Authorization"] = "Bearer " + token;
      }
    }

    // DEBUG: 打印请求信息
    console.log(
      "[API]",
      method,
      BASE_URL + fullPath,
      "token=",
      token ? token.slice(0, 20) + "..." : "EMPTY",
    );

    // 入口日志：确认 request 函数被调用了
    console.log(
      "[API>>] request called, path=",
      path,
      "options=",
      JSON.stringify(options),
    );

    uni.request({
      url: BASE_URL + fullPath,
      method,
      header,
      data: body,
      success: (res) => {
        // DEBUG: 打印响应
        console.log("[API] response", JSON.stringify(res.data)?.slice(0, 300));

        // HTTP 状态码非 2xx → 视为网络/服务器错误
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let msg = "请求失败";
          if (res.statusCode === 401) msg = "登录已过期，请重新登录";
          else if (res.statusCode === 403) msg = "无权限访问";
          else if (res.statusCode === 500) msg = "服务器异常";
          uni.showToast({ title: msg, icon: "none" });
          // 401 也要清除 token 并跳转
          if (res.statusCode === 401) {
            uni.removeStorageSync("token");
            uni.removeStorageSync("user_info");
            setTimeout(() => uni.reLaunch({ url: "/pages/login/login" }), 1500);
          }
          reject(res);
          return;
        }

        const data = res.data;
        // data 不是合法 JSON 对象
        if (!data || typeof data !== "object") {
          uni.showToast({ title: "响应格式异常", icon: "none" });
          reject(res);
          return;
        }

        // 认证错误 → 跳转登录
        if (data.code === 40101 || data.code === 40102) {
          uni.removeStorageSync("token");
          uni.removeStorageSync("user_info");
          uni.showToast({ title: "登录已过期，请重新登录", icon: "none" });
          setTimeout(() => {
            uni.reLaunch({ url: "/pages/login/login" });
          }, 1500);
          reject(data);
          return;
        }

        // 无管理员权限
        if (data.code === 40303) {
          uni.showToast({ title: "无管理员权限", icon: "none" });
          reject(data);
          return;
        }

        // AI 识别失败
        if (data.code === 50002 || data.code === 50003) {
          uni.showToast({ title: "AI识别失败，请稍后重试", icon: "none" });
          reject(data);
          return;
        }

        // 其他业务错误
        if (data.code !== 0) {
          uni.showToast({ title: data.message || "请求失败", icon: "none" });
          reject(data);
          return;
        }

        // 兼容：后端 list 类接口双层包装 {code,data:{code,data:{list/total}}}
        // 判断依据：data.data 本身也是标准响应结构（含有 code 字段）
        let unwrapped = data;
        if (data.data && typeof data.data === "object" && "code" in data.data) {
          const inner = data.data;
          unwrapped = {
            code: inner.code,
            message: inner.message,
            data: inner.data,
          };
        }

        resolve(unwrapped);
      },
      fail: (err) => {
        uni.showToast({ title: "网络异常，请检查网络", icon: "none" });
        reject(err);
      },
    });
  });
}
export { request };
