import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'

/** 报警(源码 service/bean/Alarm.java) */
export interface Alarm {
  id: number
  channelId?: number
  /** 国标通道编号 */
  channelDeviceId?: string
  channelName?: string
  description?: string
  snapPath?: string
  recordPath?: string
  longitude?: number
  latitude?: number
  /** 报警类型(GB28181 枚举,见 AlarmType.java) */
  alarmType?: string
  /** 毫秒时间戳 */
  alarmTime?: number
}

/** 报警类型(AlarmType 枚举的主要取值) */
export const ALARM_TYPES = [
  'VideoLoss',
  'DeviceTamper',
  'StorageFull',
  'DeviceHighTemperature',
  'DeviceLowTemperature',
  'ManualVideo',
  'MotionDetection',
  'LeftObjectDetection',
  'ObjectRemovalDetection',
  'TripwireDetection',
  'IntrusionDetection',
  'MobileDetection',
  'VideoOcclusion',
  'ReverseDetection',
  'LoiteringDetection',
] as const

/** 报警分页(04 §4.7);alarmType 可重复传,beginTime/endTime 格式 yyyy-MM-dd HH:mm:ss */
export function queryAlarms(params: {
  page: number
  count: number
  alarmType?: string[]
  beginTime?: string
  endTime?: string
}): Promise<PageInfo<Alarm>> {
  return unwrapWvp(
    request.get('/api/alarm/list', {
      params: {
        page: params.page,
        count: params.count,
        ...(params.alarmType?.length ? { alarmType: params.alarmType } : {}),
        ...(params.beginTime ? { beginTime: params.beginTime } : {}),
        ...(params.endTime ? { endTime: params.endTime } : {}),
      },
    }),
  )
}

/** 按 ID 删除(04 §4.7): DELETE body 为 number[] */
export function deleteAlarms(ids: number[]): Promise<void> {
  return unwrapWvp(request.delete('/api/alarm/delete', { data: ids }))
}

/** 按过滤条件清空 */
export function clearAlarms(params: {
  alarmType?: string[]
  beginTime?: string
  endTime?: string
}): Promise<void> {
  return unwrapWvp(
    request.delete('/api/alarm/clear', {
      params: {
        ...(params.alarmType?.length ? { alarmType: params.alarmType } : {}),
        ...(params.beginTime ? { beginTime: params.beginTime } : {}),
        ...(params.endTime ? { endTime: params.endTime } : {}),
      },
    }),
  )
}

/**
 * 报警快照(04 §4.7): JPEG 二进制,204 无内容。
 * 走带 token 的 axios,返回 objectURL 供 img 展示。
 */
export async function fetchAlarmSnap(id: number): Promise<string | null> {
  const resp = await request.get(`/api/alarm/snap/${id}`, { responseType: 'blob' })
  const blob = resp.data as Blob
  if (blob.size === 0) return null
  return URL.createObjectURL(blob)
}
