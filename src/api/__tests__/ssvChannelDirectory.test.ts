import request from '@/api/request'
import { querySsvWvpChannelDirectory } from '@/api/ssvChannelDirectory'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SSV WVP 通道目录适配层', () => {
  it('读取当前 WVP 设备和通道接口，并映射 GB 通道 ID 而不暴露数据库 ID', async () => {
    const requests: Array<{ path: string; params: Record<string, unknown> }> = []
    const get = vi.spyOn(request, 'get')
    get.mockImplementation((path, config) => {
      const params = (config?.params ?? {}) as Record<string, unknown>
      requests.push({ path, params })

      let page: { total: number; list: unknown[] }
      if (path === '/api/device/query/devices') {
        page = {
          total: 1,
          list: [{ deviceId: params.status ? 'device-online' : 'device-offline' }],
        }
      } else if (path.endsWith('/device-online/channels')) {
        page = {
          total: 2,
          list:
            params.page === 1
              ? [
                  { id: 701, channelId: 'gb-channel-1', name: '门厅', channelType: 0 },
                  { id: 702, channelId: 'virtual-group', name: '分组', channelType: 2 },
                ]
              : [],
        }
      } else if (path.endsWith('/device-offline/channels')) {
        page =
          params.page === 1
            ? {
                total: 101,
                list: [{ id: 801, channelId: 'gb-channel-2', name: '停车场', channelType: 0 }],
              }
            : {
                total: 101,
                list: [{ id: 802, channelId: 'gb-channel-3', name: '仓库', channelType: 0 }],
              }
      } else {
        throw new Error(`Unexpected WVP request: ${path}`)
      }

      return Promise.resolve({
        data: { code: 0, msg: 'success', data: page },
      } as Awaited<ReturnType<typeof request.get>>)
    })

    await expect(querySsvWvpChannelDirectory()).resolves.toEqual([
      { gbDeviceId: 'gb-channel-1', gbName: '门厅' },
      { gbDeviceId: 'gb-channel-2', gbName: '停车场' },
      { gbDeviceId: 'gb-channel-3', gbName: '仓库' },
    ])

    const deviceRequests = requests.filter(({ path }) => path === '/api/device/query/devices')
    expect(deviceRequests.map(({ params }) => params.status).sort()).toEqual([false, true])
    expect(deviceRequests.every(({ params }) => params.query === '' && params.count === 100)).toBe(
      true,
    )

    const channelRequests = requests.filter(({ path }) => path.endsWith('/channels'))
    expect(channelRequests).toHaveLength(3)
    expect(
      channelRequests.every(({ params }) => params.channelType === false && params.count === 100),
    ).toBe(true)
    expect(channelRequests.some(({ params }) => params.page === 2)).toBe(true)
    expect(requests.some(({ path }) => path === '/api/common/channel/list')).toBe(false)
  })
})
