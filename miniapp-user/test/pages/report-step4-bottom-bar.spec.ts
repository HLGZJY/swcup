// BUG-019 (2026-07-06): report 页 step 4 的提交按钮被移到内容区,造成与步骤 5/5 指示器重叠
// 修复:把"提交上报"放回 bottom-bar,与"上一步"50/50 对半排
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// 关键:把 onLoad/onShow mock 成 ref 暴露出去,这样页面调用时不会报错
const mockOnLoadHandler = ref<any>(null)
const mockOnShowHandler = ref<any>(null)

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (handler: any) => { mockOnLoadHandler.value = handler },
  onShow: (handler: any) => { mockOnShowHandler.value = handler },
  onUnload: () => {},
}))

vi.mock('@/services/api', () => ({
  apiUploadFile: vi.fn(),
  apiReportEvent: vi.fn(),
}))

// 简化 UnifiedReportForm:只渲染 sighting-hint 文本,不渲染 submit 按钮
vi.mock('@/components/unified-report-form/index.vue', () => ({
  default: {
    name: 'UnifiedReportForm',
    template: '<view class="unified-mock" />',
    props: ['mode', 'defaultIntent', 'animalId'],
  },
}))

;(globalThis as any).uni = {
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  getStorageSync: vi.fn(() => ''),
  removeStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  chooseImage: vi.fn(),
  chooseLocation: vi.fn(),
  getLocation: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  redirectTo: vi.fn(),
  navigateBack: vi.fn(),
}

const ReportPage = (await import('@/pages/report/index.vue' as any)).default

function mountReport() {
  return mount(ReportPage as any, {
    global: { mocks: { $mp: { query: {} } } },
  })
}

describe('report 页 step 4 bottom-bar 布局 (BUG-019)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('step 4 时 bottom-bar 同时含"上一步"和"提交上报"两个按钮', async () => {
    const wrapper = mountReport()
    const vm = wrapper.vm as any
    vm.currentStep = 4
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('.bottom-bar')
    expect(bar.exists()).toBe(true)
    // 上一步仍存在
    expect(bar.find('.btn-back').exists()).toBe(true)
    // 提交上报必须存在于 bottom-bar (不是隐藏在组件内)
    expect(bar.find('.btn-submit').exists()).toBe(true)
    expect(bar.find('.btn-submit').text()).toContain('提交上报')
  })

  it('step 4 时 step 4 section 内不再含组件的 submit 按钮 (避免双提交/重叠)', async () => {
    const wrapper = mountReport()
    const vm = wrapper.vm as any
    vm.currentStep = 4
    await wrapper.vm.$nextTick()

    // step 4 section 里不应该有 .unified-report-form .submit-btn 这样的内联提交按钮
    // (用 component-mock 的 .unified-mock 不带 submit 按钮 来验证)
    const section = wrapper.find('.section')
    expect(section.find('.unified-report-form .submit-btn').exists()).toBe(false)
  })

  it('step 0-3 时 bottom-bar 显示"上一步"+"下一步",不显示"提交上报"', async () => {
    const wrapper = mountReport()
    const vm = wrapper.vm as any
    vm.currentStep = 1
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('.bottom-bar')
    expect(bar.find('.btn-back').exists()).toBe(true)
    expect(bar.find('.btn-next').exists()).toBe(true)
    expect(bar.find('.btn-submit').exists()).toBe(false)
  })
})
