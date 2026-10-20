import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElSelect } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LinkageBindingsView from '../LinkageBindingsView.vue'

const mocks = vi.hoisted(() => ({
  listPoints: vi.fn(),
  listBindings: vi.fn(),
  replaceBindings: vi.fn(),
  queryDevices: vi.fn(),
  queryChannels: vi.fn(),
}))

vi.mock('@/api/linkageGateway', () => ({
  getLinkageGatewayApiBaseURL: () => 'http://localhost:8766',
  listLinkagePoints: mocks.listPoints,
  listLinkageBindings: mocks.listBindings,
  replaceLinkageBindings: mocks.replaceBindings,
}))

vi.mock('@/api/device', () => ({
  queryDevices: mocks.queryDevices,
  queryChannels: mocks.queryChannels,
}))

const point = {
  pointKey: '1_1',
  stationNo: 1,
  monitorIndex: 1,
  deviceName: '1号主变/断路器/位置',
  deviceType: '遥信',
  physicalId: 'physical-1',
  linkageEnabled: true,
  importId: 1,
  updatedAt: '2026-10-20T00:00:00Z',
}

const device = {
  deviceId: 'gb-device-1',
  name: '在线摄像机',
  onLine: true,
}

const channel = {
  channelId: 'gb-channel-1',
  deviceId: 'gb-device-1',
  channelType: 0,
  name: '摄像机通道 1',
}

describe('LinkageBindingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listPoints.mockResolvedValue([point])
    mocks.listBindings.mockResolvedValue([])
    mocks.replaceBindings.mockImplementation(async (pointKey, bindings) =>
      bindings.map((binding: Record<string, unknown>) => ({ ...binding, pointKey })),
    )
    mocks.queryDevices.mockResolvedValue({ list: [device], total: 1 })
    mocks.queryChannels.mockResolvedValue({ list: [channel], total: 1 })
  })

  it('shows point semantics and allows binding a selected WVP channel', async () => {
    const wrapper = mount(LinkageBindingsView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(wrapper.text()).toContain('1_1')
    expect(wrapper.text()).toContain('1号主变/断路器/位置')
    expect(wrapper.text()).toContain('未绑定')

    const editButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('编辑绑定'))
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    await flushPromises()

    const selects = wrapper.find('.binding-row').findAllComponents(ElSelect)
    expect(selects).toHaveLength(2)
    selects[0]!.vm.$emit('change', 'gb-device-1')
    await flushPromises()
    selects[1]!.vm.$emit('change', 'gb-channel-1')

    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('保存绑定'))
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(mocks.replaceBindings).toHaveBeenCalledWith('1_1', [
      {
        deviceId: 'gb-device-1',
        channelId: 'gb-channel-1',
        name: '摄像机通道 1',
        enabled: true,
        displayOrder: 0,
      },
    ])
    expect(wrapper.text()).toContain('摄像机通道 1')
    expect(wrapper.text()).toContain('gb-device-1 / gb-channel-1')
    wrapper.unmount()
  })

  it('rejects duplicate WVP channel bindings before saving', async () => {
    const wrapper = mount(LinkageBindingsView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    const editButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('编辑绑定'))
    await editButton!.trigger('click')
    await flushPromises()

    let rows = wrapper.findAll('.binding-row')
    let selects = rows[0]!.findAllComponents(ElSelect)
    selects[0]!.vm.$emit('change', 'gb-device-1')
    await flushPromises()
    selects[1]!.vm.$emit('change', 'gb-channel-1')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('添加通道绑定'))!
      .trigger('click')

    rows = wrapper.findAll('.binding-row')
    selects = rows[1]!.findAllComponents(ElSelect)
    selects[0]!.vm.$emit('change', 'gb-device-1')
    await flushPromises()
    selects[1]!.vm.$emit('change', 'gb-channel-1')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('保存绑定'))!
      .trigger('click')
    await flushPromises()

    expect(mocks.replaceBindings).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('clears existing bindings when the last channel is removed', async () => {
    mocks.listBindings.mockResolvedValue([
      {
        pointKey: '1_1',
        deviceId: 'gb-device-1',
        channelId: 'gb-channel-1',
        name: '摄像机通道 1',
        enabled: true,
        displayOrder: 0,
      },
    ])
    const wrapper = mount(LinkageBindingsView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    const editButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('编辑绑定'))
    await editButton!.trigger('click')
    await flushPromises()
    await wrapper.find('.binding-row button').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('保存绑定'))!
      .trigger('click')
    await flushPromises()

    expect(mocks.replaceBindings).toHaveBeenCalledWith('1_1', [])
    expect(wrapper.text()).toContain('未绑定')
    wrapper.unmount()
  })
})
