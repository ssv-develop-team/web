import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElDialog } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LinkageVideoDialog from '../LinkageVideoDialog.vue'

const mocks = vi.hoisted(() => ({
  startPlay: vi.fn(),
  stopPlay: vi.fn(),
  createPlayer: vi.fn(),
  selectFlvUrl: vi.fn(),
}))

vi.mock('@/api/play', () => ({
  startPlay: mocks.startPlay,
  stopPlay: mocks.stopPlay,
}))

vi.mock('@/player', () => ({
  createJessibucaPlayer: mocks.createPlayer,
}))

vi.mock('@/player/stream', () => ({
  selectFlvUrl: mocks.selectFlvUrl,
}))

const event = {
  type: 'linkage_event' as const,
  schemaVersion: 1 as const,
  eventId: 'evt-1',
  sequence: 1,
  pointKey: '1_1',
  stationNo: 1,
  monitorIndex: 1,
  deviceName: '测试遥信点',
  eventType: '遥信',
  property: '变位',
  value: '合位',
  eventTime: '2026-10-19T15:42:40.382+08:00',
  receivedAt: '2026-10-19T15:42:41.000+08:00',
  matchStatus: 'matched' as const,
  channels: [{ deviceId: 'wvp-device', channelId: 'wvp-channel', name: '测试摄像机' }],
}

describe('LinkageVideoDialog', () => {
  const player = {
    on: vi.fn(),
    play: vi.fn(),
    destroy: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startPlay.mockResolvedValue({ ws_flv: 'ws://media/live.flv' })
    mocks.stopPlay.mockResolvedValue(undefined)
    mocks.createPlayer.mockReturnValue(player)
    mocks.selectFlvUrl.mockReturnValue('ws://media/live.flv')
    player.play.mockResolvedValue(undefined)
  })

  it('starts the bound channel and stops it when the dialog closes', async () => {
    const wrapper = mount(LinkageVideoDialog, {
      props: { event },
      global: { plugins: [ElementPlus] },
    })

    wrapper.findComponent(ElDialog).vm.$emit('opened')
    await flushPromises()

    expect(mocks.startPlay).toHaveBeenCalledWith('wvp-device', 'wvp-channel')
    expect(mocks.createPlayer).toHaveBeenCalledOnce()
    expect(player.play).toHaveBeenCalledWith('ws://media/live.flv')

    wrapper.findComponent(ElDialog).vm.$emit('closed')
    await flushPromises()

    expect(player.destroy).toHaveBeenCalledOnce()
    expect(mocks.stopPlay).toHaveBeenCalledOnce()
    expect(mocks.stopPlay).toHaveBeenCalledWith('wvp-device', 'wvp-channel')
    wrapper.unmount()
  })

  it('stops a point play that completes after the dialog has closed', async () => {
    let resolveStartPlay: (value: { ws_flv: string }) => void = () => undefined
    mocks.startPlay.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStartPlay = resolve
      }),
    )
    const wrapper = mount(LinkageVideoDialog, {
      props: { event },
      global: { plugins: [ElementPlus] },
    })

    wrapper.findComponent(ElDialog).vm.$emit('opened')
    await flushPromises()
    wrapper.findComponent(ElDialog).vm.$emit('closed')
    resolveStartPlay({ ws_flv: 'ws://media/live.flv' })
    await flushPromises()

    expect(mocks.stopPlay).toHaveBeenCalledOnce()
    expect(mocks.createPlayer).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
