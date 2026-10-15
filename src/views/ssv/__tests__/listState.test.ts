import { describe, expect, it } from 'vitest'

import { eventListQuery, parseEventListState } from '../listState'

describe('SSV 事件列表路由状态', () => {
  it('保留筛选与分页，未知值回退到安全默认值', () => {
    const state = parseEventListState({
      query: 'event-1',
      status: 'manual_review',
      channel_id: '34020000001320000001',
      page: '3',
      page_size: '50',
    })
    expect(state).toEqual({
      query: 'event-1',
      status: 'manual_review',
      channelId: '34020000001320000001',
      page: 3,
      pageSize: 50,
    })
    expect(eventListQuery(state)).toEqual({
      query: 'event-1',
      status: 'manual_review',
      channel_id: '34020000001320000001',
      page: '3',
      page_size: '50',
    })
    expect(parseEventListState({ status: 'processing', page: '0', page_size: '1000' })).toEqual({
      query: '',
      status: '',
      channelId: '',
      page: 1,
      pageSize: 20,
    })
  })
})
