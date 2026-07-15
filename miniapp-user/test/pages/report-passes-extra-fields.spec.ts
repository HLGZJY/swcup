import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

const mockApiReportEvent = vi.fn()
const mockOnLoadHandler = ref<any>(null)
const mockOnShowHandler = ref<any>(null)

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (handler: any) => { mockOnLoadHandler.value = handler },
  onShow: (handler: any) => { mockOnShowHandler.value = handler },
  onUnload: () => {},
}))

vi.mock('@/services/api', () => ({
  apiUploadFile: vi.fn(async (p: string) => `/static/uploads/${p}`),
  apiReportEvent: mockApiReportEvent,
}))

;(globalThis as any).uni = {
  showToast: vi.fn(),
  showModal: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  reLaunch: vi.fn(),
  switchTab: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(() => null),
  removeStorageSync: vi.fn(),
  getLocation: vi.fn(({ success }: any) =>
    success?.({ latitude: 30.5, longitude: 114.3 }),
  ),
  chooseLocation: vi.fn(),
  chooseImage: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  showShareMenu: vi.fn(),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  redirectTo: vi.fn(),
}
;(globalThis as any).getCurrentPages = vi.fn(() => [{ options: {} }])
;(globalThis as any).getCurrentPage = vi.fn(() => ({ options: {} }))

const ReportPage = (await import('@/pages/report/index.vue' as any)).default

describe('报告页透传 4 字段 (2026-07-14 bug一致性)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockApiReportEvent.mockReset() })
  afterEach(() => { vi.useRealTimers() })

  it('handleReportSubmit 把 age/health/sterilized/photos 写入 payload', async () => {
    mockApiReportEvent.mockResolvedValue({ data: { event_id: 'e1' } })
    const w = mount(ReportPage as any, {
      global: { mocks: { $mp: { query: {} } } },
    })
    await flushPromises()
    const vm = w.vm as any
    vm.currentStep = 4
    vm.selectedSpecies = 'dog'
    vm.photos = ['local1.jpg', 'local2.jpg']
    vm.photoUrls = ['/static/uploads/1.jpg', '/static/uploads/2.jpg']
    vm.breed = '金毛'
    vm.color = '金色'
    vm.gender = 'male'
    vm.age = 'junior'
    vm.health = 'healthy'
    vm.sterilized = 'yes'
    vm.description = '亲人'
    vm.locationLat = 30.5
    vm.locationLng = 114.3
    vm.locationText = 'test'

    await vm.handleReportSubmit({})
    await flushPromises()

    expect(mockApiReportEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        age_estimate: 'junior',
        health_status: 'healthy',
        sterilized: true,
        photos: ['/static/uploads/1.jpg', '/static/uploads/2.jpg'],
      }),
    )
  })
})
