import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSsvEventDetail } from '@/api/ssv'
import type { SsvEventDetail } from '@/api/types/ssv'
import SsvEvidenceImage from '@/components/SsvEvidenceImage.vue'

import SsvEventDetailView from '../SsvEventDetailView.vue'
import { deferred, detail } from './fixtures'

vi.mock('@/api/ssv', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/ssv')>(),
  fetchSsvEventDetail: vi.fn(),
}))

const requestDetail = vi.mocked(fetchSsvEventDetail)
let wrapper: VueWrapper | undefined
let router: Router

async function openDetail(path = '/events/event-one') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/events/:eventId', name: 'ssv-event-detail', component: SsvEventDetailView },
      { path: '/events', name: 'ssv-events', component: { template: '<p>列表页</p>' } },
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
  requestDetail.mockReset()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('SSV 事件详情页面', () => {
  it('首次请求、选择精确当前修订，切换时结论与引用更新而图库不变', async () => {
    requestDetail.mockResolvedValue(detail())
    const view = await openDetail('/events/event-one?query=区域&status=pending&channel_id=00001&page=3&page_size=50')
    await flushPromises()

    expect(requestDetail).toHaveBeenCalledWith('event-one', expect.any(AbortSignal))
    expect(view.text()).toContain('结论解释 event-one R2')
    expect(view.text()).not.toContain('结论解释 event-one R1')
    expect(view.findAllComponents(SsvEvidenceImage).map((image) => image.props('record').evidence_id)).toEqual(['frame-one', 'frame-two', 'unavailable', 'unreferenced'])
    expect(view.text()).toContain('未登记')
    expect(view.text()).toContain('已登记但不可用')
    expect(view.text()).toContain('可用图片')
    expect(view.text()).toContain('视频暂不展示')
    expect(view.find('video').exists()).toBe(false)
    expect(view.text()).toContain('ID 0')
    expect(view.text()).toContain('遮挡')

    const galleryBefore = view.findAllComponents(SsvEvidenceImage).map((image) => image.element)
    await view.findAll('button').find((button) => button.text().startsWith('R1'))!.trigger('click')
    expect(view.text()).toContain('结论解释 event-one R1')
    expect(view.text()).not.toContain('结论解释 event-one R2')
    expect(view.text()).not.toContain('视频暂不展示')
    expect(view.findAllComponents(SsvEvidenceImage).map((image) => image.element)).toEqual(galleryBefore)
    expect(view.find('.conclusion-title').text()).toContain('不确定')

    await view.find('.detail-toolbar a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ssv-events')
    expect(router.currentRoute.value.query).toEqual({ query: '区域', status: 'pending', channel_id: '00001', page: '3', page_size: '50' })
  })

  it('当前修订找不到时明确显示未匹配，可手动选择本事件历史修订', async () => {
    const response = detail()
    response.event.current_revision = 5
    requestDetail.mockResolvedValue(response)
    const view = await openDetail()
    await flushPromises()
    expect(view.text()).toContain('当前修订未匹配')
    expect(view.text()).toContain('尚无可匹配的分析结论修订')
    expect(view.text()).not.toContain('结论解释')
    expect(view.findAll('.revision-tabs button')).toHaveLength(2)
    await view.findAll('button').find((button) => button.text().startsWith('R1'))!.trigger('click')
    expect(view.text()).toContain('结论解释 event-one R1')
  })

  it('清除旧详情并中止旧请求，迟到成功响应不能覆盖新的事件', async () => {
    const old = deferred<SsvEventDetail>()
    const next = deferred<SsvEventDetail>()
    requestDetail.mockResolvedValueOnce(detail('initial')).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const view = await openDetail('/events/initial')
    await flushPromises()
    expect(view.text()).toContain('结论解释 initial R2')
    await router.push('/events/old')
    await flushPromises()
    expect(view.text()).not.toContain('结论解释 initial R2')
    expect(view.text()).toContain('正在读取事件详情')
    const oldSignal = requestDetail.mock.calls[1]![1]!
    await router.push('/events/new')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    old.resolve(detail('old'))
    await flushPromises()
    expect(view.text()).toContain('正在读取事件详情')
    expect(view.text()).not.toContain('结论解释 old R2')
    next.resolve(detail('new'))
    await flushPromises()
    expect(view.text()).toContain('结论解释 new R2')
    expect(view.text()).not.toContain('结论解释 old R2')
  })

  it('组件卸载取消请求，取消/旧失败不会显示错误或污染新请求', async () => {
    const old = deferred<SsvEventDetail>()
    const next = deferred<SsvEventDetail>()
    requestDetail.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const view = await openDetail('/events/old')
    const oldSignal = requestDetail.mock.calls[0]![1]!
    await router.push('/events/new')
    await flushPromises()
    old.reject(new DOMException('cancelled', 'AbortError'))
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    expect(view.text()).not.toContain('事件详情暂不可用')
    const newSignal = requestDetail.mock.calls[1]![1]!
    view.unmount()
    wrapper = undefined
    expect(newSignal.aborted).toBe(true)
    next.reject(new Error('late rejection'))
    await flushPromises()
  })

  it('请求失败可重试；无结论、无图片和无检测都有明确状态', async () => {
    const response = detail()
    response.review_history = []
    response.evidence = []
    response.detections = []
    response.event.current_revision = null
    response.event.verdict = null
    response.event.confidence = null
    response.event.channel_id = null
    requestDetail.mockRejectedValueOnce(new Error('事件不存在')).mockResolvedValueOnce(response)
    const view = await openDetail()
    await flushPromises()
    expect(view.text()).toContain('事件详情暂不可用')
    expect(view.text()).toContain('事件不存在')
    await view.findAll('button').find((button) => button.text() === '重试')!.trigger('click')
    await flushPromises()
    expect(view.text()).toContain('尚无分析结论修订')
    expect(view.text()).toContain('没有登记图片')
    expect(view.text()).toContain('事件未提供检测摘要')
    expect(view.text()).toContain('未形成结论')
    expect(view.text()).toContain('未关联通道')
  })

  it('选中修订没有引用时显示空引用状态', async () => {
    const response = detail()
    response.review_history.forEach((review) => { review.evidence_ids = [] })
    requestDetail.mockResolvedValue(response)
    const view = await openDetail()
    await flushPromises()
    expect(view.text()).toContain('此修订没有引用证据')
  })
})
