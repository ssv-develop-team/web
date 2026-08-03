import request, { unwrapWvp } from './request'

import type { StreamContent } from '@/player/stream'

/**
 * 发起国标点播(04 §4.4):发送 SIP INVITE 并异步等待流就绪。
 * 超时比普通接口长,界面需显示"正在向设备请求"。
 */
export function startPlay(deviceId: string, channelId: string): Promise<StreamContent> {
  return unwrapWvp(
    request.get(`/api/play/start/${deviceId}/${channelId}`, { timeout: 30000 }),
  )
}

/**
 * 停止点播;播放器关闭/切台/组件卸载时必须调用(04 §6.3),
 * 避免设备和媒体服务残留流。
 */
export function stopPlay(deviceId: string, channelId: string): Promise<void> {
  return unwrapWvp(request.get(`/api/play/stop/${deviceId}/${channelId}`))
}
