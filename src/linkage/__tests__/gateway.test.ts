import { describe, expect, it } from 'vitest'

import { parseLinkageEvent } from '../gateway'

const validEvent = {
  type: 'linkage_event',
  schemaVersion: 1,
  eventId: 'evt-20261019-000001',
  sequence: 42,
  pointKey: '1_1',
  stationNo: 1,
  monitorIndex: 1,
  deviceName: 'zh/110KV..12140.地刀',
  eventType: '遥信',
  property: '变位',
  value: '合位',
  eventTime: '2026-10-19T15:42:40.382+08:00',
  receivedAt: '2026-10-19T15:42:41.000+08:00',
  matchStatus: 'matched',
  channels: [{ deviceId: 'wvp-device-id', channelId: 'wvp-channel-id', name: '联动摄像机' }],
}

describe('parseLinkageEvent', () => {
  it('accepts a matched versioned event with explicit WVP channel IDs', () => {
    expect(parseLinkageEvent(JSON.stringify(validEvent))).toEqual(validEvent)
  })

  it.each([
    { ...validEvent, schemaVersion: 2 },
    { ...validEvent, matchStatus: 'unbound' },
    { ...validEvent, channels: [] },
    { ...validEvent, channels: [{ deviceId: '', channelId: 'channel', name: 'camera' }] },
  ])('ignores events that must not trigger playback', (payload) => {
    expect(parseLinkageEvent(payload)).toBeNull()
  })

  it('ignores malformed JSON and non-object messages', () => {
    expect(parseLinkageEvent('{')).toBeNull()
    expect(parseLinkageEvent(null)).toBeNull()
  })
})
