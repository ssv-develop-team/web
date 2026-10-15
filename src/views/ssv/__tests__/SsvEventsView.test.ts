import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { querySsvWvpChannelDirectory } from '@/api/ssvChannelDirectory'
import { fetchSsvEvents } from '@/api/ssv'
import type { SsvWvpChannelOption } from '@/api/ssvChannelDirectory'

import SsvEventsView from '../SsvEventsView.vue'
import { deferred, summary } from './fixtures'

vi.mock('@/api/ssvChannelDirectory', () => ({ querySsvWvpChannelDirectory: vi.fn() }))
vi.mock('@/api/ssv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/ssv')>()),
  fetchSsvEvents: vi.fn(),
}))

const listEvents = vi.mocked(fetchSsvEvents)
const listChannels = vi.mocked(querySsvWvpChannelDirectory)
let wrapper: VueWrapper | undefined
let router: Router

async function openList(path = '/events') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/events', name: 'ssv-events', component: SsvEventsView },
      {
        path: '/events/:eventId',
        name: 'ssv-event-detail',
        component: { template: '<p>详情页</p>' },
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(defineComponent({ components: { RouterView }, template: '<RouterView />' }), {
    attachTo: document.body,
    global: { plugins: [router, ElementPlus] },
  })
  return wrapper
}

beforeEach(() => {
  listEvents.mockReset()
  listChannels.mockReset()
  listChannels.mockResolvedValue([
    { gbDeviceId: '34020000001320000001', gbName: '东门摄像机' } satisfies SsvWvpChannelOption,
  ])
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('SSV 事件列表页面', () => {
  it('从路由恢复筛选分页，按 gbDeviceId 映射通道，并保留查询返回详情', async () => {
    listEvents.mockResolvedValue({ items: [summary()], total: 45, page: 3, page_size: 20 })
    const view = await openList(
      '/events?query=door&status=manual_review&channel_id=34020000001320000001&page=3&page_size=20',
    )
    await flushPromises()

    expect(listEvents).toHaveBeenCalledWith(
      {
        page: 3,
        pageSize: 20,
        query: 'door',
        status: 'manual_review',
        channelId: '34020000001320000001',
      },
      expect.any(AbortSignal),
    )
    expect(view.text()).toContain('东门摄像机 · 34020000001320000001')
    expect(view.text()).toContain('持久分析任务')
    expect(view.text()).toContain('已完成')
    expect(view.text()).toContain('违规')
    expect(view.text()).toContain('置信度 0.91')
    expect(view.text()).toContain('复核任务')
    expect(listChannels).toHaveBeenCalledWith(expect.any(AbortSignal))

    await view.get('a.event-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ssv-event-detail')
    expect(router.currentRoute.value.params.eventId).toBe('event-one')
    expect(router.currentRoute.value.query).toEqual({
      query: 'door',
      status: 'manual_review',
      channel_id: '34020000001320000001',
      page: '3',
      page_size: '20',
    })
  })

  it('查询会清零页码并将文本与工作流筛选映射到 SSV API', async () => {
    listEvents.mockResolvedValue({ items: [summary()], total: 1, page: 1, page_size: 20 })
    const view = await openList('/events?page=5&page_size=20')
    await flushPromises()
    const input = view.get('input[placeholder="事件 ID、来源或类型"]')
    await input.setValue('  loading dock  ')
    await input.trigger('keyup.enter')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      query: 'loading dock',
      page: '1',
      page_size: '20',
    })
    expect(listEvents).toHaveBeenLastCalledWith(
      {
        page: 1,
        pageSize: 20,
        query: 'loading dock',
        status: '',
        channelId: '',
      },
      expect.any(AbortSignal),
    )
  })

  it('列表请求和 WVP 通道目录分别可重试', async () => {
    listEvents.mockRejectedValueOnce(new Error('账本不可读')).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
    listChannels.mockRejectedValueOnce(new Error('WVP 不可用')).mockResolvedValueOnce([])
    const view = await openList()
    await flushPromises()
    expect(view.text()).toContain('账本不可读')
    expect(view.text()).toContain('WVP 不可用')
    const retryButtons = view.findAll('button').filter((button) => button.text() === '重试')
    expect(retryButtons).toHaveLength(1)
    await retryButtons[0]!.trigger('click')
    await view
      .findAll('button')
      .find((button) => button.text() === '重试通道目录')!
      .trigger('click')
    await flushPromises()
    expect(view.text()).toContain('没有匹配的事件')
    expect(view.text()).not.toContain('重试通道目录')
    expect(listEvents).toHaveBeenCalledTimes(2)
    expect(listChannels).toHaveBeenCalledTimes(2)
  })

  it('筛选参数变化时中止旧列表请求，迟到结果不能覆盖新列表', async () => {
    const oldRequest = deferred<Awaited<ReturnType<typeof fetchSsvEvents>>>()
    listEvents.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce({
      items: [summary('new-event')],
      total: 1,
      page: 1,
      page_size: 20,
    })
    const view = await openList()
    await flushPromises()
    const oldSignal = listEvents.mock.calls[0]![1]!
    const input = view.get('input[placeholder="事件 ID、来源或类型"]')
    await input.setValue('new')
    await input.trigger('keyup.enter')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    oldRequest.resolve({ items: [summary('stale-event')], total: 1, page: 1, page_size: 20 })
    await flushPromises()
    expect(view.text()).toContain('new-event')
    expect(view.text()).not.toContain('stale-event')
  })
})
