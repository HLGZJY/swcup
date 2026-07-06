import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UnifiedReportForm from '@/components/unified-report-form/index.vue'

describe('UnifiedReportForm', () => {
  it("mode='collect' 时渲染 intent 收音机", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'collect' } })
    expect(wrapper.find('.intent-radio').exists()).toBe(true)
  })

  it("mode='report' 时隐藏 intent 收音机", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'report' } })
    expect(wrapper.find('.intent-radio').exists()).toBe(false)
  })

  it("mode='collect' 默认 intent=lost", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'collect' } })
    expect((wrapper.vm as any).formData.intent).toBe('lost')
  })

  it("mode='report' 默认 intent=stray_sighting", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'report' } })
    expect((wrapper.vm as any).formData.intent).toBe('stray_sighting')
  })

  it('defaultIntent 覆盖模式默认值', () => {
    const wrapper = mount(UnifiedReportForm, {
      props: { mode: 'collect', defaultIntent: 'found' },
    })
    expect((wrapper.vm as any).formData.intent).toBe('found')
  })

  it('提交时 emit submit 携带 formData 且含 intent', async () => {
    const wrapper = mount(UnifiedReportForm, {
      props: { mode: 'report', animalId: 'a-99' },
    })
    ;(wrapper.vm as any).handleSubmit()
    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    const payload = (emitted as any)[0][0]
    expect(payload.intent).toBe('stray_sighting')
    expect(payload.animal_id).toBe('a-99')
  })
})
