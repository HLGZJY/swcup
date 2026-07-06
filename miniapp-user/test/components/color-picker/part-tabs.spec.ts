import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PartTabs from '@/components/color-picker/part-tabs.vue'
import { BODY_PARTS } from '@/components/color-picker/body-parts'
import type { PartColorsMap } from '@/components/color-picker/color-picker'

function emptyMap(): PartColorsMap {
  return { back: [], belly: [], head: [], chest: [], tail: [], legs: [], face: [] }
}

describe('PartTabs', () => {
  it('默认渲染 7 个部位标签', () => {
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'back',
        partColors: emptyMap(),
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    expect(tabs.length).toBe(7)
    for (const part of BODY_PARTS) {
      expect(wrapper.text()).toContain(part.label)
    }
  })

  it('activePart 标签带 active class', () => {
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'belly',
        partColors: emptyMap(),
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const activeTab = tabs.find((t) => t.classes().includes('active'))
    expect(activeTab).toBeTruthy()
    expect(activeTab?.text()).toContain('腹部')
  })

  it('已采部位标签带 picked class', () => {
    const colors = emptyMap()
    colors.back = [{ hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }]
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'head',
        partColors: colors,
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const pickedTab = tabs.find((t) => t.classes().includes('picked'))
    expect(pickedTab).toBeTruthy()
    expect(pickedTab?.text()).toContain('背脊')
  })

  it('未采部位无 picked 标记', () => {
    const colors = emptyMap()
    colors.back = [{ hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }]
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'back',
        partColors: colors,
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const headTab = tabs.find((t) => t.text().includes('头部'))
    expect(headTab?.classes()).not.toContain('picked')
  })

  it('点击标签 emit update:active-part', async () => {
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'back',
        partColors: emptyMap(),
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const tailTab = tabs.find((t) => t.text().includes('尾巴'))!
    await tailTab.trigger('click')
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['tail'])
  })

  it('已采部位点击时也 emit（方案 B 不再弹覆盖 modal，由 chip 上的 × 处理删除）', async () => {
    const colors = emptyMap()
    colors.back = [{ hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }]
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'head',
        partColors: colors,
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const backTab = tabs.find((t) => t.text().includes('背脊'))!
    await backTab.trigger('click')
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['back'])
  })

  // === 2026-06-27 方案 B 新增：色数 badge ===

  it('采 1 色 → 显示 "1" 角标', () => {
    const colors = emptyMap()
    colors.back = [{ hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }]
    const wrapper = mount(PartTabs, {
      props: { parts: BODY_PARTS, activePart: 'head', partColors: colors },
    })
    const backTab = wrapper.findAll('.part-tab').find((t) => t.text().includes('背脊'))!
    expect(backTab.find('.part-tab-count').text()).toBe('1')
  })

  it('采 3 色 → 显示 "3" 角标', () => {
    const colors = emptyMap()
    colors.back = [
      { hex: '#000', label: '黑色', samples: [], touchX: 0, touchY: 0 },
      { hex: '#FFF', label: '白色', samples: [], touchX: 0, touchY: 0 },
      { hex: '#D4A857', label: '黄色', samples: [], touchX: 0, touchY: 0 },
    ]
    const wrapper = mount(PartTabs, {
      props: { parts: BODY_PARTS, activePart: 'head', partColors: colors },
    })
    const backTab = wrapper.findAll('.part-tab').find((t) => t.text().includes('背脊'))!
    expect(backTab.find('.part-tab-count').text()).toBe('3')
  })
})
