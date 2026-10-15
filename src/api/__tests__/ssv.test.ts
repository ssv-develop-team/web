import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchSsvEventDetail,
  fetchSsvEvents,
  SsvApiError,
  ssvEvidenceImageUrl,
} from '@/api/ssv'
import { detail, summary } from '@/views/ssv/__tests__/fixtures'

afterEach(() => {
  localStorage.clear()
})

describe('SSV API 适配层', () => {
  it('使用独立同源 GET，保留通道编码，不附加 WVP 登录令牌', async () => {
    localStorage.setItem('access-token', 'wvp-test-token')
    const response = { items: [summary()], total: 30, page: 2, page_size: 20 }
    const fetch = vi.fn().mockResolvedValue(Response.json(response))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()

    expect(await fetchSsvEvents({ page: 2, pageSize: 20, query: ' 区域 ', status: 'pending', channelId: '000001' }, controller.signal)).toEqual(response)
    const [url, options] = fetch.mock.calls[0]!
    const requestUrl = new URL(url, 'http://ui.local')
    expect(requestUrl.pathname).toBe('/ssv-api/api/v1/events')
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({ page: '2', page_size: '20', query: '区域', status: 'pending', channel_id: '000001' })
    expect(options).toMatchObject({ method: 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
    expect(new Headers(options.headers).has('access-token')).toBe(false)
    expect(new Headers(options.headers).has('Authorization')).toBe(false)
  })

  it('分别编码稳定事件和证据 ID，只使用图片 API', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(detail('event /?#')))
    vi.stubGlobal('fetch', fetch)
    await fetchSsvEventDetail('event /?#')
    expect(fetch.mock.calls[0]![0]).toBe('/ssv-api/api/v1/events/event%20%2F%3F%23')
    expect(ssvEvidenceImageUrl('event /?#', 'frame /?#')).toBe('/ssv-api/api/v1/events/event%20%2F%3F%23/evidence/frame%20%2F%3F%23/image')
  })

  it('仅将服务端可省略的 coverage 映射为 null', async () => {
    const raw: Record<string, unknown> = detail()
    raw.evidence = [{ event_id: 'event-one', evidence_id: 'frame-one', kind: 'frame', status: 'available', mime_type: 'image/png', size: 42 }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(raw)))
    const response = await fetchSsvEventDetail('event-one')
    expect(response.evidence[0]?.coverage).toBeNull()
  })

  it.each([null, [], {}, { ...detail(), event: { ...summary(), analysis_task: null } }, { ...detail(), event: summary('different-event') }])('拒绝不符合契约或事件 ID 的成功响应 %#', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    await expect(fetchSsvEventDetail('event-one')).rejects.toThrow('SSV API 响应格式不符合事件契约')
  })

  it('提取标准错误体，并保留 HTTP 状态与错误码', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'event_not_found', message: '事件不存在' } }, { status: 404 })))
    await expect(fetchSsvEventDetail('absent')).rejects.toMatchObject({ name: 'SsvApiError', status: 404, code: 'event_not_found', message: '事件不存在' })
  })

  it('对代理返回的非 JSON 成功页给出契约错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>nginx</html>')))
    await expect(fetchSsvEvents({ page: 1, pageSize: 20 })).rejects.toBeInstanceOf(SsvApiError)
  })

  it('连接错误可解释，取消错误保持取消语义', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchSsvEventDetail('event-one')).rejects.toMatchObject({ status: 0, message: '无法连接 SSV 事件服务' })
    const aborted = new DOMException('Cancelled', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted))
    await expect(fetchSsvEventDetail('event-one')).rejects.toBe(aborted)
  })
})
