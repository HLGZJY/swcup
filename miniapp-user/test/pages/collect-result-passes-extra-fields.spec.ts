import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mockApiCreateAnimal = vi.fn()
const mockApiReportEvent = vi.fn()
const mockApiNoseCompare = vi.fn()
const mockApiNoseCollect = vi.fn()
const mockApiGetAnimalDetail = vi.fn()

vi.mock('@/services/api', () => ({
  apiCreateAnimal: mockApiCreateAnimal,
  apiReportEvent: mockApiReportEvent,
  apiNoseCompare: mockApiNoseCompare,
  apiNoseCollect: mockApiNoseCollect,
  apiGetAnimalDetail: mockApiGetAnimalDetail,
  apiClassifyBreed: vi.fn(),
  apiUploadFile: vi.fn(),
  resolveImageUrl: vi.fn((url: string) => url),
}))

;(globalThis as any).uni = {
  getLocation: vi.fn(),
  chooseLocation: vi.fn(),
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
  switchTab: vi.fn(),
  showModal: vi.fn(),
  navigateBack: vi.fn(),
}

const ResultPage = (await import('@/pages/collect/result.vue' as any)).default

describe('collect → result 数据传递(age/health/sterilized/notes)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiCreateAnimal.mockReset()
    mockApiReportEvent.mockReset()
    mockApiNoseCompare.mockReset()
  })

  it('result 页 onMounted 接收 age/health/sterilized/notes 参数并存到 ref', async () => {
    // 模拟 collect 跳过来带了 4 个字段
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'v1',
          species: 'dog',
          breed: '金毛',
          color: '金色',
          gender: 'male',
          age: 'adult',
          health: 'healthy',
          sterilized: 'unknown',
          notes: '佩戴蓝色项圈,尾巴尖有白毛',
          body_photo_url: '',
          nose_photo_url: '',
        },
      },
    ])
    mockApiNoseCompare.mockResolvedValue({
      data: { results: [], next_action: 'no_match' },
    })

    const wrapper = mount(ResultPage as any)
    await flushPromises()
    const vm = wrapper.vm as any

    expect(vm.formAge).toBe('adult')
    expect(vm.formHealth).toBe('healthy')
    expect(vm.formSterilized).toBe('unknown')
    expect(vm.formNotes).toContain('蓝色项圈')
  })

  it('result 页 onCreateAnimal 调用 apiCreateAnimal 时使用用户选的实际值', async () => {
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'v1',
          species: 'dog',
          breed: '金毛',
          color: '金色',
          gender: 'male',
          age: 'adult',
          health: 'healthy',
          sterilized: 'unknown',
          notes: '佩戴蓝色项圈,尾巴尖有白毛',
          body_photo_url: '',
          nose_photo_url: '',
        },
      },
    ])
    mockApiNoseCompare.mockResolvedValue({
      data: { results: [], next_action: 'no_match' },
    })
    mockApiCreateAnimal.mockResolvedValue({ data: { animal_id: 'a-new' } })
    mockApiReportEvent.mockResolvedValue({ data: {} })

    const wrapper = mount(ResultPage as any)
    await flushPromises()

    // 调用 onCreateAnimal (用户点"创建档案"按钮)
    await (wrapper.vm as any).onCreateAnimal()
    await flushPromises()

    expect(mockApiCreateAnimal).toHaveBeenCalledTimes(1)
    const callArg = mockApiCreateAnimal.mock.calls[0][0]
    // 用户选的健康/成年 入库应该是 healthy/adult,不是写死的 unknown
    expect(callArg.age_estimate).toBe('adult')
    expect(callArg.health_status).toBe('healthy')
    // 绝育=未知 不传字段(让后端用 NULL/默认值,避免 IsBoolean 类型校验失败)
    expect(callArg.sterilized).toBeUndefined()
    // 备注是用户的"佩戴蓝色项圈,尾巴尖有白毛",不是默认的"通过鼻纹采集新建"
    expect(callArg.notes).toContain('蓝色项圈')
    expect(callArg.notes).not.toBe('通过鼻纹采集新建')
  })

  it('result 页 onMounted 接收 location_lat/lng 并传给 apiNoseCompare (修复 Bug4 GPS NULL)', async () => {
    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        options: {
          nose_id: 'v1',
          species: 'dog',
          breed: '金毛',
          color: '金色',
          gender: 'male',
          location_lat: '31.228',
          location_lng: '121.447',
          body_photo_url: '',
          nose_photo_url: '',
        },
      },
    ])
    mockApiNoseCompare.mockResolvedValue({
      data: { results: [], next_action: 'no_match' },
    })

    mount(ResultPage as any)
    await flushPromises()

    expect(mockApiNoseCompare).toHaveBeenCalledTimes(1)
    const callArg = mockApiNoseCompare.mock.calls[0][0]
    // GPS 维度不能为 NULL,否则 fusion_score 永远 < 0.88
    expect(callArg.location_lat).toBe(31.228)
    expect(callArg.location_lng).toBe(121.447)
  })
})
