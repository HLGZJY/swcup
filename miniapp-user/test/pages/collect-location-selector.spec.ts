import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CollectPage from '@/pages/collect/index.vue'

// 屏蔽 setup 顶层调用的 uni.getLocation(避免抛错)
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
}

describe('collect 页 location-box', () => {
  it('默认渲染 location-box', () => {
    const wrapper = mount(CollectPage)
    const box = wrapper.find('.location-box')
    expect(box.exists()).toBe(true)
  })

  it('location-box 包含位置文本和提示', () => {
    const wrapper = mount(CollectPage)
    expect(wrapper.find('.location-text').exists()).toBe(true)
    expect(wrapper.find('.location-tip').exists()).toBe(true)
  })

  it('location-text 默认显示定位中', () => {
    const wrapper = mount(CollectPage)
    expect(wrapper.find('.location-text').text()).toBe('定位中...')
  })

  it('点击 location-box 触发 uni.chooseLocation', async () => {
    const wrapper = mount(CollectPage)
    await wrapper.find('.location-box').trigger('click')
    expect((globalThis as any).uni.chooseLocation).toHaveBeenCalledTimes(1)
  })

  it('GPS 获取失败时 locationText 降级为"未定位,点击选择位置"', async () => {
    ;(globalThis as any).uni.getLocation = vi.fn(({ fail }) => {
      fail && fail({ errMsg: 'getLocation:fail' })
    })
    const wrapper = mount(CollectPage)
    // 等待 micro task 队列清空
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.find('.location-text').text()).toBe('未定位,点击选择位置')
  })
})