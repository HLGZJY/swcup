import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { COLLECT_MATCH_CONTEXT_KEY } from '@/utils/collect-match-context'

const mockApiNoseCollect = vi.fn()
const mockApiNoseCompare = vi.fn()
const mockApiCreatePendingAnimalRequest = vi.fn()

vi.mock('@/services/api', () => ({
  apiGetAnimalDetail: vi.fn(),
  apiNoseCollect: mockApiNoseCollect,
  apiNoseCompare: mockApiNoseCompare,
  apiCreatePendingAnimalRequest: mockApiCreatePendingAnimalRequest,
  apiReportEvent: vi.fn(),
  apiClassifyBreed: vi.fn(),
  apiUploadFile: vi.fn(),
  resolveImageUrl: vi.fn((u: string) => u),
}))

let storage: Record<string, unknown> = {}

const uniMock = {
  getLocation: vi.fn(({ success }: any) =>
    success?.({ latitude: 30.5, longitude: 114.3 }),
  ),
  chooseLocation: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(),
  chooseImage: vi.fn(),
  setStorageSync: vi.fn((key: string, value: unknown) => {
    storage = { ...storage, [key]: value }
  }),
  getStorageSync: vi.fn((key: string) => storage[key] ?? null),
  removeStorageSync: vi.fn((key: string) => {
    const { [key]: removed, ...rest } = storage
    void removed
    storage = rest
  }),
  redirectTo: vi.fn(),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  switchTab: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: Object.keys(storage) })),
  showShareMenu: vi.fn(),
  reLaunch: vi.fn(),
}
;(globalThis as any).uni = uniMock
;(globalThis as any).getCurrentPages = vi.fn(() => [{ options: {} }])

const CollectPage = (await import('@/pages/collect/index.vue' as any)).default

describe('collect 透传 4 字段 (2026-07-14 bug4)', () => {
  beforeEach(() => {
    storage = {}
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockApiNoseCollect.mockReset()
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('onNext 把 age=junior / health=healthy / sterilized=yes 转为 boolean 写入 apiNoseCollect payload', async () => {
    mockApiNoseCollect.mockResolvedValue({
      data: { vector_id: 'v-1', next_action: 'ask_user_create' },
    })
    const w = mount(CollectPage as any)
    await flushPromises()
    const vm = w.vm as any
    vm.currentStep = 3
    vm.locationLat = 30.5
    vm.locationLng = 114.3
    vm.age = 'junior'
    vm.health = 'healthy'
    vm.sterilized = 'yes'
    vm.notes = '亲人'

    await vm.onNext()

    expect(mockApiNoseCollect).toHaveBeenCalledWith(
      expect.objectContaining({
        age_estimate: 'junior',
        health_status: 'healthy',
        sterilized: true,
        notes: '亲人',
      }),
    )
    w.unmount()
  })

  it('sterilized=no → false / unknown → null', async () => {
    mockApiNoseCollect.mockResolvedValue({
      data: { vector_id: 'v-1', next_action: 'ask_user_create' },
    })
    const w = mount(CollectPage as any)
    await flushPromises()
    const vm = w.vm as any
    vm.currentStep = 3
    vm.locationLat = 30.5
    vm.locationLng = 114.3
    vm.age = 'adult'
    vm.health = 'injured'
    vm.sterilized = 'no'
    vm.notes = ''
    await vm.onNext()
    expect(mockApiNoseCollect).toHaveBeenCalledWith(
      expect.objectContaining({ sterilized: false, notes: undefined }),
    )

    vm.sterilized = 'unknown'
    await vm.onNext()
    expect(mockApiNoseCollect.mock.calls[1][0].sterilized).toBeNull()
    w.unmount()
  })

  it('有鼻纹成功时清空无鼻纹候选上下文', async () => {
    storage = {
      [COLLECT_MATCH_CONTEXT_KEY]: {
        event_id: 'old',
        next_action: 'show_high_score_dialog',
        candidates: [],
      },
    }
    mockApiNoseCollect.mockResolvedValue({
      data: { vector_id: 'v-real', next_action: 'ask_user_create' },
    })
    const w = mount(CollectPage as any)
    await flushPromises()
    const vm = w.vm as any
    vm.currentStep = 3
    vm.locationLat = 30.5
    vm.locationLng = 114.3
    vm.nosePhotoBase64 = 'data:image/jpeg;base64,VALID'
    vm.age = 'junior'
    vm.health = 'healthy'
    vm.sterilized = 'yes'
    vm.notes = ''

    await vm.onNext()

    expect(uniMock.removeStorageSync).toHaveBeenCalledWith(
      COLLECT_MATCH_CONTEXT_KEY,
    )
    expect(storage[COLLECT_MATCH_CONTEXT_KEY]).toBeUndefined()
    w.unmount()
  })
})
