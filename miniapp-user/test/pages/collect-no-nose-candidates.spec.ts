import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  COLLECT_MATCH_CONTEXT_KEY,
  createCollectMatchContext,
} from '@/utils/collect-match-context'

const mockApiNoseCollect = vi.fn()
const mockApiCreatePendingAnimalRequest = vi.fn()
const mockApiNoseCompare = vi.fn()

vi.mock('@/services/api', () => ({
  apiGetAnimalDetail: vi.fn(),
  apiNoseCollect: mockApiNoseCollect,
  apiNoseCompare: mockApiNoseCompare,
  apiCreatePendingAnimalRequest: mockApiCreatePendingAnimalRequest,
  apiReportEvent: vi.fn(),
  apiClassifyBreed: vi.fn(),
  apiUploadFile: vi.fn(),
  resolveImageUrl: vi.fn((url: string) => url),
}))

let storage: Record<string, unknown> = {}

const uniMock = {
  getLocation: vi.fn(({ success }: any) =>
    success?.({ latitude: 30.49984, longitude: 114.34253 }),
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
const ResultPage = (await import('@/pages/collect/result.vue' as any)).default

const rawCandidate = {
  animal_id: 'animal-1',
  breed: '金毛',
  color: '金色',
  gender: 'male',
  status: 'lost',
  photos: ['/static/uploads/golden.jpg'],
  address: '武汉市洪山区',
  fusion_score: 0.86,
  scores: {
    image_similarity: null,
    gps_similarity: 0.9,
    text_match_rate: 0.7,
    time_score: 0.6,
  },
  distance_m: 320,
  is_recommended: true,
}

describe('collect 页无鼻纹候选 handoff', () => {
  beforeEach(() => {
    storage = {}
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('无鼻纹响应应把候选写入一次性上下文', async () => {
    mockApiNoseCollect.mockResolvedValue({
      data: {
        event_id: 'event-1',
        vector_id: null,
        next_action: 'show_high_score_dialog',
        candidates: [rawCandidate],
      },
    })
    const wrapper = mount(CollectPage as any)
    await flushPromises()
    const vm = wrapper.vm as any
    vm.currentStep = 3
    vm.locationLat = 30.49984
    vm.locationLng = 114.34253
    vm.nosePhotoBase64 = ''

    await vm.onNext()

    expect(uniMock.setStorageSync).toHaveBeenCalledWith(
      COLLECT_MATCH_CONTEXT_KEY,
      expect.objectContaining({
        event_id: 'event-1',
        next_action: 'show_high_score_dialog',
        candidates: [expect.objectContaining({ animal_id: 'animal-1' })],
      }),
    )
    wrapper.unmount()
  })

  it('有鼻纹响应应清除上一次无鼻纹候选', async () => {
    storage = {
      [COLLECT_MATCH_CONTEXT_KEY]: {
        event_id: 'old-event',
        next_action: 'show_high_score_dialog',
        candidates: [rawCandidate],
      },
    }
    mockApiNoseCollect.mockResolvedValue({
      data: {
        vector_id: 'vector-1',
        next_action: 'ask_user_create',
        candidates: [],
      },
    })
    const wrapper = mount(CollectPage as any)
    await flushPromises()
    const vm = wrapper.vm as any
    vm.currentStep = 3
    vm.locationLat = 30.49984
    vm.locationLng = 114.34253
    vm.nosePhotoBase64 = 'data:image/jpeg;base64,VALID'

    await vm.onNext()

    expect(uniMock.removeStorageSync).toHaveBeenCalledWith(
      COLLECT_MATCH_CONTEXT_KEY,
    )
    expect(storage[COLLECT_MATCH_CONTEXT_KEY]).toBeUndefined()
    wrapper.unmount()
  })
})

describe('result 页无鼻纹候选流程', () => {
  beforeEach(() => {
    storage = {}
    vi.clearAllMocks()
    vi.useRealTimers()
    mockApiCreatePendingAnimalRequest.mockResolvedValue({
      data: {
        record_id: 'event-created',
        vector_id: null,
        next_action: 'under_review',
      },
    })
  })

  it('高分属性候选应跳过鼻纹 compare 并展示核对与建档入口', async () => {
    storage = {
      [COLLECT_MATCH_CONTEXT_KEY]: createCollectMatchContext({
        event_id: 'event-1',
        next_action: 'show_high_score_dialog',
        candidates: [rawCandidate],
      }),
    }
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{
      options: {
        nose_id: 'null',
        next_action: 'show_high_score_dialog',
        species: 'dog',
        breed: '金毛',
        color: '金色',
        gender: 'male',
        location_lat: '30.49984',
        location_lng: '114.34253',
        intent: 'found',
      },
    }])

    const wrapper = mount(ResultPage as any)
    await flushPromises()

    expect(mockApiNoseCompare).not.toHaveBeenCalled()
    expect(wrapper.html()).toContain('金毛')
    expect(wrapper.html()).toContain('查看候选动物')
    expect(wrapper.html()).toContain('仍要创建档案')
    expect(uniMock.removeStorageSync).toHaveBeenCalledWith(
      COLLECT_MATCH_CONTEXT_KEY,
    )
    wrapper.unmount()
  })

  it('高分属性候选允许在无鼻纹向量时提交待审档案', async () => {
    storage = {
      [COLLECT_MATCH_CONTEXT_KEY]: createCollectMatchContext({
        event_id: 'event-1',
        next_action: 'show_high_score_dialog',
        candidates: [rawCandidate],
      }),
    }
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{
      options: {
        nose_id: 'null',
        next_action: 'show_high_score_dialog',
        species: 'dog',
        breed: '金毛',
        color: '金色',
        gender: 'male',
        location_lat: '30.49984',
        location_lng: '114.34253',
        intent: 'found',
      },
    }])

    const wrapper = mount(ResultPage as any)
    await flushPromises()
    await (wrapper.vm as any).onCreateAnimal()
    await flushPromises()

    expect(mockApiCreatePendingAnimalRequest).toHaveBeenCalledTimes(1)
    expect(mockApiCreatePendingAnimalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        nose_vector_id: undefined,
        species: 'dog',
        intent: 'found',
      }),
    )
    wrapper.unmount()
  })

  it('无候选时跳过 compare 并保留创建档案入口', async () => {
    storage = {
      [COLLECT_MATCH_CONTEXT_KEY]: createCollectMatchContext({
        event_id: 'event-2',
        next_action: 'show_no_candidate_dialog',
        candidates: [],
      }),
    }
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{
      options: {
        nose_id: 'null',
        next_action: 'show_no_candidate_dialog',
        species: 'dog',
        location_lat: '30.49984',
        location_lng: '114.34253',
      },
    }])

    const wrapper = mount(ResultPage as any)
    await flushPromises()

    expect(mockApiNoseCompare).not.toHaveBeenCalled()
    expect(wrapper.html()).toContain('创建档案')
    wrapper.unmount()
  })
})
