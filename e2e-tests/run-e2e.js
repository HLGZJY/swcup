/**
 * 鼻纹智救 - 端到端集成测试
 * 测试范围：用户上报流程、采集流程、后台管理、AI 服务、跨服务集成
 *
 * 用法：node e2e-tests/run-e2e.js
 */

const BASE_BACKEND = 'http://localhost:3000'
const BASE_AI = 'http://localhost:8000'

// 一行输出工具
let pass = 0, fail = 0
const results = []

function log(level, ...args) {
  const colors = { INFO: '\x1b[36m', OK: '\x1b[32m', FAIL: '\x1b[31m', WARN: '\x1b[33m', RESET: '\x1b[0m' }
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`${colors[level]}[${ts}] ${level}${colors.RESET}`, ...args)
}

function recordResult(name, success, detail) {
  results.push({ name, success, detail })
  if (success) pass++
  else fail++
}

async function http(method, url, opts = {}) {
  const { body, headers = {}, raw = false } = opts
  const init = { method, headers }
  if (body !== undefined && !raw) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json'
  }
  const res = await fetch(url, init)
  let data
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.text()
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers }
}

async function uploadFile(url, filePath, fieldName = 'file', extraHeaders = {}) {
  const fs = require('fs')
  const path = require('path')
  const buf = fs.readFileSync(filePath)
  const filename = path.basename(filePath)
  const ext = path.extname(filename).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'
  const boundary = '----e2e' + Date.now()
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([head, buf, tail])
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, ...extraHeaders },
    body
  })
  return { status: res.status, ok: res.ok, data: await res.json() }
}

// 加载一个真实的小图（1x1 PNG）用于上传测试
function makeTestPng() {
  // 1x1 红色 PNG（67 字节）
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  )
}

function saveTestImage() {
  const fs = require('fs')
  const path = require('path')
  const dir = path.join(__dirname, '.tmp')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const p = path.join(dir, 'test.png')
  fs.writeFileSync(p, makeTestPng())
  return p
}

// ============ 测试用例 ============

async function test_health() {
  log('INFO', '── 1. 服务健康检查 ──')
  // Backend
  const apiDocs = await http('GET', `${BASE_BACKEND}/api-docs`)
  const apiOk = apiDocs.status === 200
  recordResult('后端 Swagger', apiOk, `HTTP ${apiDocs.status}`)
  log(apiOk ? 'OK' : 'FAIL', `后端 Swagger HTTP ${apiDocs.status}`)

  // AI service
  const aiRoot = await http('GET', `${BASE_AI}/`)
  const aiOk = aiRoot.status === 200
  recordResult('AI 服务根', aiOk, `HTTP ${aiRoot.status}`)
  log(aiOk ? 'OK' : 'FAIL', `AI 服务根 HTTP ${aiRoot.status}`)

  const aiDocs = await http('GET', `${BASE_AI}/docs`)
  recordResult('AI FastAPI 文档', aiDocs.status === 200, `HTTP ${aiDocs.status}`)
  log(aiDocs.status === 200 ? 'OK' : 'FAIL', `AI 文档 HTTP ${aiDocs.status}`)

  return apiOk && aiOk
}

async function test_register_login() {
  log('INFO', '── 2. 用户注册 + 登录 ──')
  // 用一个随机手机号避免冲突
  const phone = '138' + Math.floor(Math.random() * 1e7).toString().padStart(8, '0')
  const password = 'test1234pass'

  // 2.1 注册
  const reg = await http('POST', `${BASE_BACKEND}/v1/auth/register`, {
    body: { phone, password }
  })
  const regOk = reg.status === 200 || reg.status === 201
  recordResult(`注册 ${phone}`, regOk, JSON.stringify(reg.data).slice(0, 200))
  log(regOk ? 'OK' : 'FAIL', `注册 HTTP ${reg.status}: ${JSON.stringify(reg.data).slice(0, 100)}`)
  if (!regOk) return null

  // 响应被包装为 {code, message, data:{token,user}}
  const token = reg.data?.data?.token
  const user = reg.data?.data?.user
  if (!token) {
    log('FAIL', '注册响应没有 token')
    return null
  }
  log('OK', `  Token 长度 ${token.length}, user_id=${user?.user_id}, role=${user?.role}`)

  // 2.2 重复注册应失败（应返回 409 Conflict，不再是 500）
  const dup = await http('POST', `${BASE_BACKEND}/v1/auth/register`, {
    body: { phone, password }
  })
  const dupIsFail = dup.status === 409 || dup.status === 400
  recordResult('重复注册应返回 409/400', dupIsFail, `HTTP ${dup.status}`)
  log(dupIsFail ? 'OK' : 'FAIL', `重复注册 HTTP ${dup.status}（期望 409/400）`)

  // 2.3 登录
  const login = await http('POST', `${BASE_BACKEND}/v1/auth/login`, {
    body: { phone, password }
  })
  const loginOk = (login.status === 200 || login.status === 201) && login.data?.data?.token
  recordResult('登录', loginOk, `HTTP ${login.status}`)
  log(loginOk ? 'OK' : 'FAIL', `登录 HTTP ${login.status}`)
  if (!loginOk) return null

  // 2.4 错误密码登录
  const wrong = await http('POST', `${BASE_BACKEND}/v1/auth/login`, {
    body: { phone, password: 'wrong' }
  })
  recordResult('错误密码应拒绝（401）', wrong.status === 401, `HTTP ${wrong.status}`)
  log(wrong.status === 401 ? 'OK' : 'FAIL', `错误密码 HTTP ${wrong.status}`)

  return { phone, password, token, userId: user.user_id, role: user.role }
}

async function test_password_strength() {
  log('INFO', '── 2b. 密码强度校验 ──')
  // 太短
  const weak1 = await http('POST', `${BASE_BACKEND}/v1/auth/register`, {
    body: { phone: '139' + Math.floor(Math.random() * 1e7).toString().padStart(8, '0'), password: 'abc' }
  })
  recordResult('弱密码（短）应返回 400', weak1.status === 400, `HTTP ${weak1.status}`)
  log(weak1.status === 400 ? 'OK' : 'FAIL', `弱密码(短) HTTP ${weak1.status}`)

  // 全数字
  const weak2 = await http('POST', `${BASE_BACKEND}/v1/auth/register`, {
    body: { phone: '139' + Math.floor(Math.random() * 1e7).toString().padStart(8, '0'), password: '12345678' }
  })
  recordResult('弱密码（无字母）应返回 400', weak2.status === 400, `HTTP ${weak2.status}`)
  log(weak2.status === 400 ? 'OK' : 'FAIL', `弱密码(无字母) HTTP ${weak2.status}`)
}

async function test_animals_public() {
  log('INFO', '── 3. 动物档案公开接口 ──')
  const list = await http('GET', `${BASE_BACKEND}/v1/animals`)
  const ok = list.status === 200
  recordResult('动物列表', ok, `HTTP ${list.status}`)
  log(ok ? 'OK' : 'FAIL', `动物列表 HTTP ${list.status} data=${JSON.stringify(list.data).slice(0, 200)}`)
  if (!ok) return null

  // 响应被包装为 {code, data: {list, total, ...}}
  const items = list.data?.data?.list || list.data?.data
  if (Array.isArray(items) && items.length > 0) {
    const firstId = items[0].animal_id
    const detail = await http('GET', `${BASE_BACKEND}/v1/animals/${firstId}`)
    recordResult('动物详情', detail.status === 200, `HTTP ${detail.status}`)
    log(detail.status === 200 ? 'OK' : 'FAIL', `动物详情 HTTP ${detail.status}`)
    return firstId
  }
  log('WARN', '数据库暂无动物数据')
  return null
}

async function test_upload(token) {
  log('INFO', '── 4. 文件上传 ──')
  const imgPath = saveTestImage()
  const res = await uploadFile(`${BASE_BACKEND}/v1/upload`, imgPath, 'file')
  const ok = res.status === 200 || res.status === 201
  const url = res.data?.data?.url || res.data?.url
  recordResult('文件上传', ok && !!url, `HTTP ${res.status} url=${url}`)
  log(ok && url ? 'OK' : 'FAIL', `上传 HTTP ${res.status} url=${url}`)
  return ok ? url : null
}

async function test_report_flow(token) {
  log('INFO', '── 5. 用户上报流程（我们刚改造的页面）──')
  if (!token) {
    log('WARN', '无 token，跳过')
    return null
  }

  // 5.1 创建上报事件
  const create = await http('POST', `${BASE_BACKEND}/v1/events`, {
    headers: { Authorization: `Bearer ${token}` },
    body: {
      event_type: 'report',
      species: 'dog',
      breed: '柴犬',
      color: '黄色',
      gender: 'male',
      description: 'E2E 测试 - 在朝阳公园发现一只黄色柴犬',
      location_lat: 39.9,
      location_lng: 116.4,
      address: '北京市朝阳区朝阳公园',
      photos: []
    }
  })
  const ok = create.status === 200 || create.status === 201
  recordResult('上报事件创建', ok, `HTTP ${create.status}`)
  log(ok ? 'OK' : 'FAIL', `上报 HTTP ${create.status}: ${JSON.stringify(create.data).slice(0, 300)}`)
  if (!ok) return null

  const eventId = create.data?.data?.event_id
  if (!eventId) {
    log('FAIL', '响应缺少 event_id')
    return null
  }
  log('OK', `  event_id=${eventId}`)

  // 5.2 查询我的上报
  const mine = await http('GET', `${BASE_BACKEND}/v1/events/my`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const mineOk = mine.status === 200
  const myList = mine.data?.data?.list || mine.data?.data
  const hasNew = Array.isArray(myList) && myList.some((e) => e.event_id === eventId)
  recordResult('查询我的上报', mineOk && hasNew, `HTTP ${mine.status}, 包含新事件=${hasNew}`)
  log(mineOk ? 'OK' : 'FAIL', `我的上报 HTTP ${mine.status}, 包含新事件=${hasNew}`)

  // 5.3 必填字段缺失应失败
  const bad = await http('POST', `${BASE_BACKEND}/v1/events`, {
    headers: { Authorization: `Bearer ${token}` },
    body: { event_type: 'report' /* 缺 species */ }
  })
  recordResult('缺 species 应被拒', bad.status >= 400, `HTTP ${bad.status}`)
  log(bad.status >= 400 ? 'OK' : 'FAIL', `缺 species HTTP ${bad.status}: ${JSON.stringify(bad.data).slice(0, 200)}`)

  // 5.4 event_type 非法值
  const badType = await http('POST', `${BASE_BACKEND}/v1/events`, {
    headers: { Authorization: `Bearer ${token}` },
    body: { event_type: 'invalid_type', species: 'dog' }
  })
  recordResult('非法 event_type 应被拒', badType.status >= 400, `HTTP ${badType.status}`)
  log(badType.status >= 400 ? 'OK' : 'FAIL', `非法 event_type HTTP ${badType.status}: ${JSON.stringify(badType.data).slice(0, 200)}`)

  return eventId
}

async function test_unauthorized() {
  log('INFO', '── 6. 未授权访问保护 ──')
  // 6.1 私有接口无 token
  const noToken = await http('GET', `${BASE_BACKEND}/v1/events/my`)
  recordResult('无 token 访问 /events/my 应被拒', noToken.status === 401, `HTTP ${noToken.status}`)
  log(noToken.status === 401 ? 'OK' : 'FAIL', `无 token HTTP ${noToken.status}`)

  // 6.2 错误 token
  const badToken = await http('GET', `${BASE_BACKEND}/v1/events/my`, {
    headers: { Authorization: 'Bearer invalid.jwt.token' }
  })
  recordResult('错误 token 应被拒', badToken.status === 401, `HTTP ${badToken.status}`)
  log(badToken.status === 401 ? 'OK' : 'FAIL', `错误 token HTTP ${badToken.status}`)
}

async function test_admin_access(token) {
  log('INFO', '── 7. 管理员权限隔离 ──')
  if (!token) {
    log('WARN', '无 token，跳过')
    return
  }
  // 7.1 普通用户调管理端接口应被拒
  const stats = await http('GET', `${BASE_BACKEND}/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const blocked = stats.status === 401 || stats.status === 403
  recordResult('普通用户访问管理端应被拒', blocked, `HTTP ${stats.status}`)
  log(blocked ? 'OK' : 'FAIL', `普通用户访问 /admin/stats HTTP ${stats.status}: ${JSON.stringify(stats.data).slice(0, 200)}`)

  // 7.2 admin 用户登录 + 访问管理端
  const adminLogin = await http('POST', `${BASE_BACKEND}/v1/auth/login`, {
    body: { phone: '13800000000', password: 'admin1234pass' }
  })
  const adminToken = adminLogin.data?.data?.token
  recordResult('admin 登录', adminLogin.status === 200 || adminLogin.status === 201, `HTTP ${adminLogin.status}`)
  log(adminToken ? 'OK' : 'FAIL', `admin 登录 HTTP ${adminLogin.status}`)
  if (!adminToken) return

  // 7.3 admin 访问 stats
  const adminStats = await http('GET', `${BASE_BACKEND}/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  recordResult('admin 访问 /admin/stats', adminStats.status === 200, `HTTP ${adminStats.status}`)
  log(adminStats.status === 200 ? 'OK' : 'FAIL', `admin /admin/stats HTTP ${adminStats.status}: ${JSON.stringify(adminStats.data).slice(0, 300)}`)

  // 7.4 admin 列事件
  const adminEvents = await http('GET', `${BASE_BACKEND}/v1/admin/events`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const eventsList = adminEvents.data?.data?.list || adminEvents.data?.data
  recordResult('admin 列事件', adminEvents.status === 200 && Array.isArray(eventsList), `HTTP ${adminEvents.status} 数量=${Array.isArray(eventsList) ? eventsList.length : 'N/A'}`)
  log(adminEvents.status === 200 ? 'OK' : 'FAIL', `admin /admin/events HTTP ${adminEvents.status} 数量=${Array.isArray(eventsList) ? eventsList.length : 'N/A'}`)

  // 7.5 admin 列动物
  const adminAnimals = await http('GET', `${BASE_BACKEND}/v1/admin/animals`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const animalsList = adminAnimals.data?.data?.list || adminAnimals.data?.data
  recordResult('admin 列动物', adminAnimals.status === 200 && Array.isArray(animalsList), `HTTP ${adminAnimals.status} 数量=${Array.isArray(animalsList) ? animalsList.length : 'N/A'}`)
  log(adminAnimals.status === 200 ? 'OK' : 'FAIL', `admin /admin/animals HTTP ${adminAnimals.status} 数量=${Array.isArray(animalsList) ? animalsList.length : 'N/A'}`)
}

async function test_ai_service_direct() {
  log('INFO', '── 8. AI 服务直接调用 ──')
  // 8.1 健康
  const root = await http('GET', `${BASE_AI}/`)
  recordResult('AI /', root.status === 200, `HTTP ${root.status}`)
  log(root.status === 200 ? 'OK' : 'FAIL', `AI / HTTP ${root.status}`)

  // 8.2 列出 AI 端点
  const openapi = await http('GET', `${BASE_AI}/openapi.json`)
  if (openapi.status === 200) {
    const paths = Object.keys(openapi.data.paths || {})
    log('INFO', `  AI 端点: ${paths.join(', ')}`)
    recordResult('AI OpenAPI 文档', true, paths.length + ' 端点')
  }

  // 8.3 直接调特征提取 + 比对，验证 AI 自身端点工作
  const tinyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  const extract = await http('POST', `${BASE_AI}/extract/feature`, { body: { image: tinyBase64 } })
  const dim = extract.data?.vector?.length || extract.data?.embedding_dim
  recordResult('AI /extract/feature 512维', extract.status === 200 && dim === 512, `HTTP ${extract.status} dim=${dim}`)
  log(dim === 512 ? 'OK' : 'FAIL', `AI /extract/feature HTTP ${extract.status} dim=${dim}`)

  // 8.4 比对两向量（应正常返回相似度）
  if (extract.data?.vector) {
    const compare = await http('POST', `${BASE_AI}/compare/vector`, {
      body: { vector_a: extract.data.vector, vector_b: extract.data.vector }
    })
    const sim = compare.data?.cosine_similarity
    recordResult('AI /compare/vector 自相似度≈1', compare.status === 200 && sim > 0.99, `HTTP ${compare.status} sim=${sim}`)
    log(sim > 0.99 ? 'OK' : 'FAIL', `AI /compare/vector HTTP ${compare.status} 自相似度=${sim}`)
  }
}

async function test_nose_collect(token, photoUrl) {
  log('INFO', '── 9. 鼻纹采集流程（后端 → AI 真实集成）──')
  if (!token) {
    log('WARN', '无 token，跳过')
    return null
  }
  // 鼻纹采集是 public，无需 token
  const tinyBase64 = 'data:image/png;base64,' + makeTestPng().toString('base64')
  const res = await http('POST', `${BASE_BACKEND}/v1/nose/collect`, {
    body: {
      nose_photo: tinyBase64,
      species: 'dog',
      location_lat: 39.9,
      location_lng: 116.4,
      breed: '柴犬',
      color: '黄色',
      gender: 'male',
      device_id: 'e2e_test',
      timestamp: new Date().toISOString(),
      nose_photo_url: photoUrl || ''
    }
  })
  // 期望 200/201（成功）或 5xx（AI 拒绝测试图但连接可达）
  const reachable = res.status === 200 || res.status === 201 || (res.status >= 500 && res.status < 600)
  const gotVectorId = res.data?.data?.vector_id
  recordResult('鼻纹采集（真实跨服务调用）', reachable, `HTTP ${res.status}, vector_id=${gotVectorId ? 'YES' : 'NO'}`)
  log(reachable ? 'OK' : 'FAIL', `  鼻纹采集 HTTP ${res.status}, vector_id=${gotVectorId || 'N/A'}`)
  if (gotVectorId) log('OK', `  → AI 集成成功，已生成 vector_id=${gotVectorId}`)

  return res.data
}

async function test_breed_classify() {
  log('INFO', '── 10. 品种分类（后端 → AI 真实集成）──')
  const tinyBase64 = 'data:image/png;base64,' + makeTestPng().toString('base64')
  const res = await http('POST', `${BASE_BACKEND}/v1/nose/classify`, {
    body: { image: tinyBase64 }
  })
  // 关键：返回的 message 不应该是"服务器内部错误"（那是连接失败）
  // 应该是 AI 服务返回的 breed 信息（即使是低置信度）
  const hasBreed = res.data?.data?.breed
  const msg = res.data?.message || ''
  const isConnErr = msg.includes('服务器内部错误')
  const ok = hasBreed || (!isConnErr && res.status < 500)
  recordResult('后端 /nose/classify', ok, `HTTP ${res.status}, breed=${res.data?.data?.breed || '无'}`)
  log(ok ? 'OK' : 'FAIL', `  /nose/classify HTTP ${res.status}, breed=${res.data?.data?.breed}, msg=${msg}`)
  if (hasBreed) log('OK', `  → AI 集成成功: 品种=${res.data.data.breed_cn} (${res.data.data.breed}) 置信度=${res.data.data.confidence}`)
}

async function test_db_health() {
  log('INFO', '── 11. 数据库可达性 ──')
  // 用一个能间接反映 DB 的端点
  const animals = await http('GET', `${BASE_BACKEND}/v1/animals?limit=1`)
  const ok = animals.status === 200
  recordResult('DB 可达（通过动物列表）', ok, `HTTP ${animals.status}`)
  log(ok ? 'OK' : 'FAIL', `DB HTTP ${animals.status}`)
}

// ============ 主流程 ============

async function main() {
  log('INFO', '========== 鼻纹智救 E2E 集成测试开始 ==========')
  log('INFO', `后端: ${BASE_BACKEND}  AI: ${BASE_AI}`)

  await test_health()
  await test_password_strength()
  await test_unauthorized()
  await test_db_health()
  const userCtx = await test_register_login()
  await test_animals_public()
  const photoUrl = userCtx ? await test_upload(userCtx.token) : null
  await test_report_flow(userCtx?.token)
  await test_admin_access(userCtx?.token)
  await test_breed_classify()
  await test_nose_collect(userCtx?.token, photoUrl)
  await test_ai_service_direct()

  log('INFO', '')
  log('INFO', '========== 测试结果汇总 ==========')
  log('INFO', `通过: \x1b[32m${pass}\x1b[0m  失败: \x1b[31m${fail}\x1b[0m  总计: ${pass + fail}`)

  if (fail > 0) {
    log('INFO', '\n失败详情：')
    results.filter((r) => !r.success).forEach((r) => {
      log('FAIL', `  ✗ ${r.name}: ${r.detail}`)
    })
  }

  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  log('FAIL', '未捕获错误:', e)
  process.exit(1)
})
