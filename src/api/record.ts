import request, { unwrapWvp } from './request'

import type { StreamContent } from '@/player/stream'

/** 设备录像片段(源码 RecordItem bean) */
export interface RecordItem {
  deviceId?: string
  name?: string
  filePath?: string
  /** 录像文件大小(Byte) */
  fileSize?: string
  address?: string
  /** yyyy-MM-dd HH:mm:ss */
  startTime: string
  /** yyyy-MM-dd HH:mm:ss */
  endTime: string
  /** 0 不涉密, 1 涉密 */
  secrecy?: number
  /** time / alarm / manual */
  type?: string
  recorderId?: string
}

/**
 * 查询设备录像片段(04 §4.6);异步 SIP,超时比普通接口长。
 * 时间格式 yyyy-MM-dd HH:mm:ss。
 */
export function queryGBRecords(
  deviceId: string,
  channelId: string,
  startTime: string,
  endTime: string,
): Promise<RecordItem[]> {
  return unwrapWvp(
    request.get(`/api/gb_record/query/${deviceId}/${channelId}`, {
      params: { startTime, endTime },
      timeout: 30000,
    }),
  )
}

/** 启动回放(04 §4.6);streamId 必须取返回 StreamContent 的 stream 字段,不可自行拼接 */
export function startPlayback(
  deviceId: string,
  channelId: string,
  startTime: string,
  endTime: string,
): Promise<StreamContent> {
  return unwrapWvp(
    request.get(`/api/playback/start/${deviceId}/${channelId}`, {
      params: { startTime, endTime },
      timeout: 30000,
    }),
  )
}

export function pausePlayback(streamId: string): Promise<void> {
  return unwrapWvp(request.get(`/api/playback/pause/${streamId}`))
}

export function resumePlayback(streamId: string): Promise<void> {
  return unwrapWvp(request.get(`/api/playback/resume/${streamId}`))
}

/** seekTime 单位秒 */
export function seekPlayback(streamId: string, seekTime: number): Promise<void> {
  return unwrapWvp(request.get(`/api/playback/seek/${streamId}/${seekTime}`))
}

/** 速度仅 0.25/0.5/1/2/4/8 */
export function speedPlayback(streamId: string, speed: number): Promise<void> {
  return unwrapWvp(request.get(`/api/playback/speed/${streamId}/${speed}`))
}

/** 释放回放流(04 §4.6);stream 为 start 返回的 stream 字段 */
export function stopPlayback(
  deviceId: string,
  channelId: string,
  stream: string,
): Promise<void> {
  return unwrapWvp(
    request.get(`/api/playback/stop/${deviceId}/${channelId}/${stream}`),
  )
}
