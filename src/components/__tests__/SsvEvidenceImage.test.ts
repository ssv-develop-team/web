import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import SsvEvidenceImage from '../SsvEvidenceImage.vue'
import { evidence } from '@/views/ssv/__tests__/fixtures'

describe('SSV 登记图片', () => {
  it('不可用登记不发图片请求，读取失败明确显示并在事件/证据变化后清除', async () => {
    const wrapper = mount(SsvEvidenceImage, {
      props: { record: { ...evidence('event-one', 'frame-one'), status: 'unavailable' } },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.text()).toContain('图片不可用')
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.setProps({ record: evidence('event-one', 'frame-one') })
    expect(wrapper.get('img').attributes('loading')).toBe('lazy')
    expect(wrapper.get('img').attributes('src')).toBe('/ssv-api/api/v1/events/event-one/evidence/frame-one/image')
    await wrapper.get('img').trigger('error')
    expect(wrapper.text()).toContain('图片读取失败')
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.setProps({ record: evidence('event-two', 'frame-one') })
    expect(wrapper.text()).not.toContain('图片读取失败')
    expect(wrapper.get('img').attributes('src')).toContain('/event-two/')
    wrapper.unmount()
  })
})
