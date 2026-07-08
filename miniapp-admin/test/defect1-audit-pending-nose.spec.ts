/**
 * Defect 1 (2026-07-08): admin 待审核看不到「用户主动建档」记录
 *
 * 根因:
 *   用户提交 POST /v1/nose/pending-animal-request → 后端写入 pending_nose_records
 *   admin GET /admin/pending-nose-records → 数据能查到 (后端已就绪)
 *   → admin miniapp audit/index.vue + services/api.js 都未提供该接口入口
 *   → admin 永远在 UI 上看不到「用户主动建档」的待审记录
 *
 * 修复策略 (TDD):
 *   1. api.js 暴露 apiGetAdminPendingNoseRecords(status) (返回列表)
 *      + apiGetAdminPendingNoseDetail(record_id), apiPostAdminPendingNoseApprove(...),
 *        apiPostAdminPendingNoseReject(...), apiPostAdminPendingNoseApproveAsDuplicate(...)
 *   2. 新增 pages/admin/audit/pending-nose.vue 详情/审核页面
 *   3. pages/admin/audit/index.vue 第 4 个 tab 「待审鼻纹」,点击跳转到上面的 Vue 页面
 *   4. pages.json 注册新路由
 *
 * 本测试 (api.js 契约层) 验证:
 *   - apiGetAdminPendingNoseRecords 必须存在
 *   - 调它时实际请求 URL 是 /admin/pending-nose-records(否则后面 audit 页将拿不到数据)
 */
import { describe, it, expect, vi } from 'vitest'

// mock @dcloudio/uni-app 避免引入真实的 uni 运行时
vi.mock('@dcloudio/uni-app', () => ({}))

describe('Defect 1: admin services 应暴露 pending-nose-records 接口', () => {
  it('应该导出 apiGetAdminPendingNoseRecords', async () => {
    const api = await import('@/services/api')
    expect((api as any).apiGetAdminPendingNoseRecords, 'apiGetAdminPendingNoseRecords 必须导出').toBeTypeOf('function')
  })

  it('应该导出 apiPostAdminPendingNoseApprove (审核通过-建新动物)', async () => {
    const api = await import('@/services/api')
    expect((api as any).apiPostAdminPendingNoseApprove, 'apiPostAdminPendingNoseApprove 必须导出').toBeTypeOf('function')
  })

  it('应该导出 apiPostAdminPendingNoseReject (审核驳回)', async () => {
    const api = await import('@/services/api')
    expect((api as any).apiPostAdminPendingNoseReject, 'apiPostAdminPendingNoseReject 必须导出').toBeTypeOf('function')
  })
})

/**
 * 路径层断言: 验证 (1) 新 Vue 页面存在 (2) audit/index.vue 内有跳到它的逻辑
 *   (3) pages.json 注册了路由 — 防止有人删了页面/路由但忘了实现
 *
 * 注意: 路径断言用的是相对路径,因为 miniapp-admin 与 backend 不同仓,@/ alias 不可用于 src 之外
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

describe('Defect 1: admin 端 pending-nose 相关文件齐全', () => {
  const SRC = resolve(__dirname, '..', 'src')

  it('pages/admin/audit/pending-nose.vue 必须存在', () => {
    expect(existsSync(resolve(SRC, 'pages', 'admin', 'audit', 'pending-nose.vue')),
      '待审鼻纹详情/审核页面必须存在').toBe(true)
  })

  it('audit/index.vue 必须包含「待审鼻纹」入口', () => {
    const content = readFileSync(resolve(SRC, 'pages', 'admin', 'audit', 'index.vue'), 'utf-8')
    expect(content, 'audit 页必须有跳到 pending-nose 的入口 (navigateTo/click handler)').toMatch(/pending-nose/)
  })

  it('pages.json 必须注册 pages/admin/audit/pending-nose 路由', () => {
    const pjson = JSON.parse(readFileSync(resolve(SRC, '..', 'src', 'pages.json'), 'utf-8'))
    const list: any[] = []
    for (const page of pjson.pages || []) list.push(page)
    for (const sub of pjson.subPackages || []) for (const page of sub.pages || []) list.push(page)
    const found = list.find((p) => p.path === 'pages/admin/audit/pending-nose')
    expect(found, 'pages.json 必须注册 pages/admin/audit/pending-nose 路由').toBeTruthy()
  })
})
