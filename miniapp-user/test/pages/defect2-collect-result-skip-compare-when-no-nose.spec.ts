/**
 * Defect 2 (2026-07-08): 无鼻纹 collect 后,navigateTo result 页卡死
 *
 * 根因:
 *   collect 跳转到 result 页时,如果后端 collect 返回 vector_id=null (无鼻纹场景),
 *   前端用 `${null}` 拼接 URL → nose_id=null (字符串) 进入 result 页
 *   result.vue:148 仅校验 `!nose_id || nose_id === 'undefined'`,放行字符串 "null"
 *   再调 apiNoseCompare({nose_id: 'null'}) → 后端 404
 *   空 catch 静默吞错,compareResult=null → 所有按钮不显示 → WeChat MP 报 navigateTo:fail timeout
 *
 * 期望行为:
 *   1. collect 把后端 next_action 透传到 result 页 (URL 参数 next_action)
 *   2. result 页检测「next_action===ask_user_confirm && 无有效 nose_id」→ 跳过 apiNoseCompare
 *   3. result 页直接展示 Plan B UI: 「创建档案」(主) + 「取消」(次) + 提示语
 *
 * TDD 流程:
 *   RED: 当前实现会调用 apiNoseCompare (期望 0 次),Plan B 按钮不出现
 *   GREEN: 加 isNoNosePath 计算 + onMounted 跳过 + needsConfirmation 兼容
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mockApiNoseCompare = vi.fn()
const mockApiCreatePendingAnimalRequest = vi.fn()

vi.mock('@/services/api', () => ({
  apiNoseCompare: mockApiNoseCompare,
  apiCreatePendingAnimalRequest: mockApiCreatePendingAnimalRequest,
  apiReportEvent: vi.fn(),
  resolveImageUrl: vi.fn((url: string) => url),
  apiUploadFile: vi.fn(),
}))

;(globalThis as any).uni = {
  showToast: vi.fn(),
  showModal: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  redirectTo: vi.fn(),
  navigateBack: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(() => null),
  removeStorageSync: vi.fn(),
  getLocation: vi.fn(),
  chooseLocation: vi.fn(),
  chooseImage: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  showShareMenu: vi.fn(),
  reLaunch: vi.fn(),
}
;(globalThis as any).getCurrentPages = vi.fn(() => [{ options: {} }])

const ResultPage = (await import('@/pages/collect/result.vue' as any)).default

describe('Defect 2: 无鼻纹场景 result 页应跳过比对,直接走 Plan B', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiNoseCompare.mockReset()
  })

  it('next_action=ask_user_confirm + nose_id="null" → apiNoseCompare 不应被调用', async () => {
    // 模拟 collect 跳过来: 无鼻纹 + 后端要求确认 (Plan B 入口)
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'null',
          next_action: 'ask_user_confirm',
          species: 'dog',
          breed: '萨摩耶',
          color: '纯白',
          gender: 'male',
          body_photo_url: '/static/uploads/x.jpg',
          nose_photo_url: '',
          intent: 'found',
        },
      },
    ])

    const wrapper = mount(ResultPage as any)
    await flushPromises()
    // 给 macrotask 拍平时间 (即使不调 api 也要等 raf 之类的)
    await new Promise((r) => setTimeout(r, 50))

    // RED 期望: apiNoseCompare 0 次 (当前会调 1 次 → 失败)
    expect(mockApiNoseCompare).toHaveBeenCalledTimes(0)
  })

  it('next_action=ask_user_confirm + 无鼻纹 → 应渲染「创建档案」+「取消」按钮', async () => {
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'null',
          next_action: 'ask_user_confirm',
          species: 'dog',
          breed: '萨摩耶',
          color: '纯白',
          gender: 'male',
          intent: 'found',
        },
      },
    ])

    const wrapper = mount(ResultPage as any)
    await flushPromises()

    const html = wrapper.html()
    // Plan B UI 文案必须出现
    expect(html).toContain('创建档案')
    expect(html).toContain('取消')
  })

  it('有正常 nose_id (v-uuid 格式) → 仍应调 apiNoseCompare (回归保护)', async () => {
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'c9d5fa50-504e-4a6c-994d-02a75264bc04',
          species: 'dog',
          breed: '萨摩耶',
        },
      },
    ])
    mockApiNoseCompare.mockResolvedValue({
      data: { results: [], next_action: 'no_match' },
    })

    mount(ResultPage as any)
    await flushPromises()

    // 正常路径仍然比对
    expect(mockApiNoseCompare).toHaveBeenCalledTimes(1)
  })
})
