import request, { unwrapWvp } from './request'

/** 移动位置(源码 gb28181/bean/MobilePosition.java) */
export interface MobilePosition {
  deviceId?: string
  channelId?: number
  /** 国标通道编号 */
  channelDeviceId?: string
  deviceName?: string
  /** 设备上报时间 */
  time?: string
  longitude: number
  latitude: number
  altitude?: number
  speed?: number
  direction?: number
  reportSource?: string
  createTime?: string
}

/** 最近位置(04 §4.7);无位置记录时 data 为 null */
export function latestPosition(deviceId: string): Promise<MobilePosition | null> {
  return unwrapWvp(request.get(`/api/position/latest/${deviceId}`))
}

/** 历史轨迹(04 §4.7);start/end 为时间字符串,留空查全部 */
export function historyPositions(
  deviceId: string,
  params: { channelId?: string; start?: string; end?: string } = {},
): Promise<MobilePosition[]> {
  return unwrapWvp(
    request.get(`/api/position/history/${deviceId}`, {
      params: {
        channelId: params.channelId || undefined,
        start: params.start || undefined,
        end: params.end || undefined,
      },
    }),
  )
}

/** 主动查询位置(异步等待设备响应,04 §4.7);设备离线会超时 */
export function realtimePosition(deviceId: string): Promise<MobilePosition | null> {
  return unwrapWvp(
    request.get(`/api/position/realtime/${deviceId}`, { timeout: 20000 }),
  )
}
