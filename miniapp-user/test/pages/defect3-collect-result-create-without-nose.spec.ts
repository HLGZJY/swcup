/**
 * Bug A (2026-07-08): 无鼻纹 collect 后,onCreateAnimal 阻断「创建档案」
 *
 * 根因:
 *   result.vue:460-463 `if (!noseId.value) { uni.showToast('缺少鼻纹ID'); return }`
 *   → 用户提交 collect(无鼻纹) → 进 result 页 → 点「创建档案」→ 早 return → 无效 toast
 *   → 用户无法在 result 页完成「待审档案」提交,流程卡死
 *
 * 期望行为:
 *   onCreateAnimal 不应阻断无鼻纹场景,应继续走 apiCreatePendingAnimalRequest
 *   (后端 Bug A GREEN 一并放宽,允许 nose_vector_id 为空)
 *
 * TDD 流程:
 *   RED: 当前实现在无鼻纹下 onCreateAnimal 不调 apiCreatePendingAnimalRequest → 失败
 *   GREEN: 删除 if (!noseId.value) 早期 return
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mockApiCreatePendingAnimalRequest = vi.fn()

vi.mock('@/services/api', () => ({
  apiCreatePendingAnimalRequest: mockApiCreatePendingAnimalRequest,
  apiNoseCompare: vi.fn(),
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
  getLocation: vi.fn(({ success }: any) =>
    success && success({ latitude: 32.629, longitude: 110.798 }),
  ),
  chooseLocation: vi.fn(),
  chooseImage: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  showShareMenu: vi.fn(),
  reLaunch: vi.fn(),
}
;(globalThis as any).getCurrentPages = vi.fn(() => [{ options: {} }])

const ResultPage = (await import('@/pages/collect/result.vue' as any)).default

describe('Bug A: 无鼻纹 collect → onCreateAnimal 不应阻断', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiCreatePendingAnimalRequest.mockReset()
    mockApiCreatePendingAnimalRequest.mockResolvedValue({
      data: { record_id: 'rec-test', vector_id: null, next_action: 'under_review' },
    })
  })

  it('无鼻纹 (noseId 空) + 点「创建档案」 → apiCreatePendingAnimalRequest 应被调用', async () => {
    // 模拟 collect 无鼻纹跳到 result 页
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'null',  // 字符串 'null' (无鼻纹)
          next_action: 'ask_user_confirm',
          species: 'dog',
          breed: '土松',
          color: '橙黄',
          gender: 'male',
          body_photo_url: '/static/uploads/x.jpg',
          intent: 'lost',
        },
      },
    ])

    const wrapper = mount(ResultPage as any)
    await flushPromises()

    // 用户点「创建档案」
    await (wrapper.vm as any).onCreateAnimal()
    await flushPromises()

    // RED 期望: 即使 noseId 空, 也应调 apiCreatePendingAnimalRequest
    // 当前实现 → 0 次 (被 if (!noseId.value) 拦截) → 失败
    expect(mockApiCreatePendingAnimalRequest).toHaveBeenCalledTimes(1)
  })

  it('调用 apiCreatePendingAnimalRequest 时 nose_vector_id 应允许空 (后端会接住)', async () => {
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'null',
          next_action: 'ask_user_confirm',
          species: 'dog',
          breed: '土松',
          color: '橙黄',
          gender: 'male',
          intent: 'lost',
        },
      },
    ])

    const wrapper = mount(ResultPage as any)
    await flushPromises()
    await (wrapper.vm as any).onCreateAnimal()
    await flushPromises()

    expect(mockApiCreatePendingAnimalRequest).toHaveBeenCalledTimes(1)
    const callArg = mockApiCreatePendingAnimalRequest.mock.calls[0][0]
    // 不应 throw,也不应要求前端硬性传入有效 UUID
    // 后端 GREEN 会让 nose_vector_id 允许 null/empty, 这里只校验调用发生
    expect(callArg).toHaveProperty('species', 'dog')
    expect(callArg).toHaveProperty('intent', 'lost')
  })
})