import { describe, expect, it } from 'vitest'

import { getWvpChannelId } from '@/api/types/wvp'

describe('WVP 通道编号兼容映射', () => {
  it('优先使用当前 Docker WVP 的 channelId', () => {
    expect(getWvpChannelId({ channelId: ' channel-one ', deviceId: 'device-one' })).toBe(
      'channel-one',
    )
  })

  it('兼容 GitHub 基线使用 deviceId 表示通道编号', () => {
    expect(getWvpChannelId({ deviceId: ' channel-one ', parentDeviceId: 'device-one' })).toBe(
      'channel-one',
    )
  })

  it('Docker 响应缺少 channelId 时不误用设备 deviceId', () => {
    expect(getWvpChannelId({ deviceId: 'device-one' })).toBeUndefined()
  })
})
