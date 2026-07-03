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
})