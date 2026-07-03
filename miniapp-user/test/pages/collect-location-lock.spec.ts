import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

// 一个延迟 resolve 的 mock,用来模拟"用户选完位置后,GPS 回调才到"的时序
const mockGetLocation = vi.fn()
const mockChooseLocation = vi.fn()

vi.mock('@/services/api', () => ({
  apiGetAnimalDetail: vi.fn(),
  apiNoseCollect: vi.fn(),
  apiNoseCompare: vi.fn(),
  apiClassifyBreed: vi.fn(),
  resolveImageUrl: vi.fn((url: string) => url),
  apiUploadFile: vi.fn(),
}))

;(globalThis as any).uni = {
  getLocation: mockGetLocation,
  chooseLocation: mockChooseLocation,
  showToast: vi.fn(),
  chooseImage: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(() => null),
  redirectTo: vi.fn(),
  navigateTo: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  removeStorageSync: vi.fn(),
  showShareMenu: vi.fn(),
}

const CollectPage = (await import('@/pages/collect/index.vue' as any)).default

describe('collect 页 location 锁定(防 GPS 覆盖用户选择)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 getLocation 永远不回调(等待状态)
    mockGetLocation.mockImplementation(() => {})
  })

  it('用户手动选位置后,后续 GPS 回调不能覆盖', async () => {
    // GPS 准备好"延迟"回调
    let resolveGps: any
    const gpsPromise = new Promise((r) => { resolveGps = r })
    mockGetLocation.mockImplementation(() => {
      // 不立刻 resolve,等用户选完位置再触发
      gpsPromise.then((coords: any) => {
        const success = (mockGetLocation.mock.calls[0]?.[0])?.success
        success && success({ latitude: coords.lat, longitude: coords.lng })
      })
    })

    const wrapper = mount(CollectPage as any)
    // 等 micro task
    await new Promise((r) => setTimeout(r, 0))

    // 用户点击 location-box 调起 chooseLocation
    await wrapper.find('.location-box').trigger('click')
    expect(mockChooseLocation).toHaveBeenCalledTimes(1)
    // 模拟用户选择了"静安公园"
    const chooseCb = mockChooseLocation.mock.calls[0]?.[0]?.success
    chooseCb && chooseCb({ latitude: 31.228, longitude: 121.447, address: '静安公园' })

    await new Promise((r) => setTimeout(r, 0))
    // 此时用户选择已生效
    expect((wrapper.vm as any).locationLat).toBe(31.228)
    expect((wrapper.vm as any).locationLng).toBe(121.447)
    expect((wrapper.vm as any).locationText).toContain('静安公园')

    // 现在 GPS 异步回调到(默认 0,0)
    resolveGps({ lat: 0, lng: 0 })
    await new Promise((r) => setTimeout(r, 10))

    // 用户的位置不应该被覆盖
    expect((wrapper.vm as any).locationLat).toBe(31.228)
    expect((wrapper.vm as any).locationLng).toBe(121.447)
    expect((wrapper.vm as any).locationText).toContain('静安公园')
  })

  it('GPS 比用户选择先到时,GPS 应被采纳(首次进入未选位置)', async () => {
    let resolveGps: any
    mockGetLocation.mockImplementation(({ success }: any) => {
      setTimeout(() => success({ latitude: 31.5, longitude: 121.5 }), 0)
    })

    const wrapper = mount(CollectPage as any)
    await new Promise((r) => setTimeout(r, 20))

    // GPS 已被采纳
    expect((wrapper.vm as any).locationLat).toBe(31.5)
    expect((wrapper.vm as any).locationLng).toBe(121.5)
  })

  it('补录模式预填位置后,GPS 回调不能覆盖', async () => {
    // 补录模式:getCurrentPages 返回 animal_id
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      { options: { animal_id: 'a1' } },
    ])
    const apiModule = await import('@/services/api' as any)
    ;(apiModule.apiGetAnimalDetail as any).mockResolvedValue({
      data: {
        animal_id: 'a1',
        species: 'dog',
        breed: '金毛',
        color: '金色',
        gender: 'male',
        address: '静安公园',
        location_lat: 31.228,
        location_lng: 121.447,
      },
    })

    // GPS 准备 0,0(默认)
    mockGetLocation.mockImplementation(({ success }: any) => {
      setTimeout(() => success({ latitude: 0, longitude: 0 }), 50)
    })

    const wrapper = mount(CollectPage as any)
    // 等补录数据加载完
    await new Promise((r) => setTimeout(r, 30))
    expect((wrapper.vm as any).animalId).toBe('a1')
    expect((wrapper.vm as any).locationText).toContain('静安公园')

    // 等 GPS 回调
    await new Promise((r) => setTimeout(r, 80))

    // 预填位置不应被 0,0 覆盖
    expect((wrapper.vm as any).locationText).toContain('静安公园')

    delete (globalThis as any).getCurrentPages
  })
})
