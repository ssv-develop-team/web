import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'
import type { Device, DeviceChannel } from './types/wvp'

export interface QueryPageParams {
  page: number
  count: number
  query?: string
}

/** 设备分页列表(04 §4.2) */
export function queryDevices(
  params: QueryPageParams & { status?: boolean },
): Promise<PageInfo<Device>> {
  return unwrapWvp(request.get('/api/device/query/devices', { params }))
}

/** 单个设备 */
export function queryDevice(deviceId: string): Promise<Device> {
  return unwrapWvp(request.get(`/api/device/query/devices/${deviceId}`))
}

export interface QueryChannelsParams extends QueryPageParams {
  online?: boolean
  /** 注意: 这里是布尔(04 §4.2);false=设备通道,true=目录。与 DeviceChannel.channelType 的 0/1/2 整数不同 */
  channelType?: boolean
}

/** 设备下通道分页 */
export function queryChannels(
  deviceId: string,
  params: QueryChannelsParams,
): Promise<PageInfo<DeviceChannel>> {
  return unwrapWvp(
    request.get(`/api/device/query/devices/${deviceId}/channels`, { params }),
  )
}

/** 指定目录下的通道 */
export function querySubChannels(
  deviceId: string,
  channelId: string,
  params: QueryPageParams,
): Promise<PageInfo<DeviceChannel>> {
  return unwrapWvp(
    request.get(`/api/device/query/sub_channels/${deviceId}/${channelId}/channels`, {
      params,
    }),
  )
}
