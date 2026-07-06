import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorPicker from '@/components/color-picker/color-picker.vue'
import type { PartColorsMap } from '@/components/color-picker/color-picker'

function emptyMap(): PartColorsMap {
  return { back: [], belly: [], head: [], chest: [], tail: [], legs: [], face: [] }
}

function pickOne(key: keyof PartColorsMap, hex = '#8B5A3C', label = '棕色') {
  const m = emptyMap()
  m[key] = [{ hex, label, samples: [hex], touchX: 0, touchY: 0 }]
  return m
}

describe('ColorPicker 容器（方案 B：1 部位 N 色）', () => {
  it('show=false 不渲染弹窗', () => {
    const wrapper = mount(ColorPicker, {
      props: { show: false, photos: [], partColors: emptyMap(), activePart: 'back' },
    })
    expect(wrapper.find('.color-picker-modal').exists()).toBe(false)
  })

  it('show=true 渲染弹窗', () => {
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['photo1.jpg'], partColors: emptyMap(), activePart: 'back' },
    })
    expect(wrapper.find('.color-picker-modal').exists()).toBe(true)
  })

  it('photos 为空时显示空态', () => {
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: [], partColors: emptyMap(), activePart: 'back' },
    })
    expect(wrapper.text()).toContain('第 2 步还没有照片')
  })

  it('minParts=5 时 <5 完成按钮 disabled', () => {
    const colors = emptyMap()
    colors.back = [{ hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }]
    colors.belly = [{ hex: '#F5E6D3', label: '其他', samples: [], touchX: 0, touchY: 0 }]
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'back', minParts: 5 },
    })
    expect(wrapper.find('.btn-confirm').classes()).toContain('disabled')
  })

  it('minParts=5 时 >=5 完成按钮激活', () => {
    const colors = emptyMap()
    ;['back', 'belly', 'head', 'chest', 'tail'].forEach((k) => {
      colors[k as keyof PartColorsMap] = [{ hex: '#FFF', label: '白色', samples: [], touchX: 0, touchY: 0 }]
    })
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'tail', minParts: 5 },
    })
    expect(wrapper.find('.btn-confirm').classes()).not.toContain('disabled')
  })

  it('PhotoCanvas emit sample → ColorPicker emit pick({partKey, color})', async () => {
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: emptyMap(), activePart: 'back', minParts: 5 },
    })
    const photoCanvas = wrapper.findComponent({ name: 'PhotoCanvas' })
    await photoCanvas.vm.$emit('sample', {
      hex: '#8B5A3C',
      label: '棕色',
      samples: ['#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C'],
      touchX: 100,
      touchY: 100,
    })
    expect(wrapper.emitted('pick')).toBeTruthy()
    expect(wrapper.emitted('pick')![0]).toEqual([
      {
        partKey: 'back',
        color: {
          hex: '#8B5A3C',
          label: '棕色',
          samples: ['#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C'],
          touchX: 100,
          touchY: 100,
        },
      },
    ])
  })

  it('点已采部位 → 不弹 modal → 直接 emit update:active-part（方案 B 不再覆盖）', async () => {
    const colors = pickOne('back')
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'head', minParts: 5 },
    })
    const showModal = vi.fn()
    ;(globalThis as any).uni.showModal = showModal
    const partTabs = wrapper.findComponent({ name: 'PartTabs' })
    await partTabs.vm.$emit('update:active-part', 'back')
    expect(showModal).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['back'])
  })

  it('点未采部位 → 直接 emit update:active-part', async () => {
    const showModal = vi.fn()
    ;(globalThis as any).uni.showModal = showModal
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: emptyMap(), activePart: 'head', minParts: 5 },
    })
    const partTabs = wrapper.findComponent({ name: 'PartTabs' })
    await partTabs.vm.$emit('update:active-part', 'tail')
    expect(showModal).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['tail'])
  })

  it('点击完成按钮 → emit confirm', async () => {
    const colors = emptyMap()
    ;['back', 'belly', 'head', 'chest', 'tail'].forEach((k) => {
      colors[k as keyof PartColorsMap] = [{ hex: '#FFF', label: '白色', samples: [], touchX: 0, touchY: 0 }]
    })
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'tail', minParts: 5 },
    })
    await wrapper.find('.btn-confirm').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('点击取消按钮 → emit update:show=false + close', async () => {
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: emptyMap(), activePart: 'back', minParts: 5 },
    })
    await wrapper.find('.btn-cancel').trigger('click')
    expect(wrapper.emitted('update:show')![0]).toEqual([false])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  // === 2026-06-27 方案 B 新增用例 ===

  it('采 1 色 → 显示该部位的色栈', async () => {
    const colors = pickOne('back', '#8B5A3C', '棕色')
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'back', minParts: 5 },
    })
    expect(wrapper.find('.part-stack').exists()).toBe(true)
    expect(wrapper.text()).toContain('背脊')
    expect(wrapper.text()).toContain('棕色')
  })

  it('采 0 色 → 不显示色栈', () => {
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: emptyMap(), activePart: 'back', minParts: 5 },
    })
    expect(wrapper.find('.part-stack').exists()).toBe(false)
  })

  it('采 2 色 → 色栈显示 2 个 chip', () => {
    const colors = emptyMap()
    colors.back = [
      { hex: '#D4A857', label: '黄色', samples: [], touchX: 0, touchY: 0 },
      { hex: '#FFFFFF', label: '白色', samples: [], touchX: 0, touchY: 0 },
    ]
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'back', minParts: 5 },
    })
    const chips = wrapper.findAll('.part-stack-chip')
    expect(chips.length).toBe(2)
  })

  it('点击色栈 chip 的 × → emit remove({partKey, index})', async () => {
    const colors = emptyMap()
    colors.back = [
      { hex: '#D4A857', label: '黄色', samples: [], touchX: 0, touchY: 0 },
      { hex: '#FFFFFF', label: '白色', samples: [], touchX: 0, touchY: 0 },
    ]
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'back', minParts: 5 },
    })
    const firstChip = wrapper.find('.part-stack-chip')
    await firstChip.trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([{ partKey: 'back', index: 0 }])
  })

  it('previewHex/previewLabel 始终显示最新采到的色（采 2 色时）', () => {
    const colors = emptyMap()
    colors.back = [
      { hex: '#D4A857', label: '黄色', samples: [], touchX: 0, touchY: 0 },
      { hex: '#FFFFFF', label: '白色', samples: [], touchX: 0, touchY: 0 },
    ]
    const wrapper = mount(ColorPicker, {
      props: { show: true, photos: ['p1.jpg'], partColors: colors, activePart: 'back', minParts: 5 },
    })
    // SamplePreview 应接收白色（最新）
    const samplePreview = wrapper.findComponent({ name: 'SamplePreview' })
    expect(samplePreview.props('hex')).toBe('#FFFFFF')
    expect(samplePreview.props('label')).toBe('白色')
  })
})