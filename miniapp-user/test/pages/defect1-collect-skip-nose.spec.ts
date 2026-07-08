/**
 * Defect 1 (2026-07-08): 采集页鼻纹步骤可跳过
 *
 * 根因:
 *   - canNext 第 2 步要求 nosePhoto,导致按钮显示灰色(disabled class)
 *   - 但 onNext 不校验 canNext,点击仍能 currentStep++ 推进
 *   - 视觉误导:按钮看着不可点,但点了又能进;再到"开始比对"时被 "请先拍摄鼻纹照片" 拦截
 *
 * 期望行为 (按测试报告):
 *   - 鼻纹那一步可跳过 (canNext 第 2 步 = true,即便没传 nose_photo)
 *   - 开始比对不强制要求鼻纹,后端已支持 (ask_user_confirm 软化)
 *
 * TDD:
 *   RED: 写测试期望 canNext 在第 2 步无鼻纹时返回 true → 当前 false → 失败
 *   GREEN: 改 canNext 第 2 步逻辑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const mockGetAnimalDetail = vi.fn()
const mockNoseCollect = vi.fn()

vi.mock('@/services/api', () => ({
  apiGetAnimalDetail: mockGetAnimalDetail,
  apiNoseCollect: mockNoseCollect,
  apiNoseCompare: vi.fn(),
  apiClassifyBreed: vi.fn(),
  resolveImageUrl: vi.fn((url: string) => url),
  apiUploadFile: vi.fn(),
}))

;(globalThis as any).uni = {
  getLocation: vi.fn(({ success }: any) => {
    success && success({ latitude: 31.228, longitude: 121.447, address: '默认位置' })
  }),
  chooseLocation: vi.fn(),
  showToast: vi.fn(),
  chooseImage: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(() => null),
  redirectTo: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  removeStorageSync: vi.fn(),
  showShareMenu: vi.fn(),
}
;(globalThis as any).getCurrentPages = vi.fn(() => [{ options: {} }])

const CollectPage = (await import('@/pages/collect/index.vue' as any)).default

describe('Defect 1: 采集页鼻纹步骤可跳过', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNoseCollect.mockReset()
  })

  it('canNext 在第 2 步(鼻纹)无鼻纹照片时应返回 true (允许跳过)', async () => {
    const wrapper = mount(CollectPage as any, {
      global: { mocks: { $mp: { query: {} } } },
    })
    if ((wrapper.vm as any).onLoad) {
      ;(wrapper.vm as any).onLoad({})
    }
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as any
    // 显式设到第 2 步且无鼻纹照片
    vm.currentStep = 2
    vm.nosePhoto = ''
    vm.nosePhotoBase64 = ''
    // canNext 第 2 步期望 true (修复前 false → 这是 RED)
    expect(vm.canNext).toBe(true)
  })

  it('onNext 在第 2 步无鼻纹照片时应能推进到第 3 步 (不被 canNext 阻止)', async () => {
    const wrapper = mount(CollectPage as any, {
      global: { mocks: { $mp: { query: {} } } },
    })
    if ((wrapper.vm as any).onLoad) {
      ;(wrapper.vm as any).onLoad({})
    }
    await new Promise((r) => setTimeout(r, 10))
    const vm = wrapper.vm as any
    vm.currentStep = 2
    vm.nosePhoto = ''
    vm.nosePhotoBase64 = ''
    await vm.onNext()
    expect(vm.currentStep).toBe(3)
  })
})