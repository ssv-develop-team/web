/** 点播返回的流地址集合(04 §4.4 StreamContent 关键字段) */
export interface StreamContent {
  app: string
  stream: string
  mediaServerId: string
  ws_flv?: string
  wss_flv?: string
  rtc?: string
  rtcs?: string
  flv?: string
  https_flv?: string
  hls?: string
  https_hls?: string
  fmp4?: string
  rtsp?: string
  rtmp?: string
  mediaInfo?: unknown
  transcodeStream?: string
}

/**
 * 协议选择(04 §4.4):
 * HTTPS 页面只选 wss_flv / rtcs,避免混合内容;HTTP 页面选 ws_flv / rtc。
 * 字段为空说明媒体节点未开启该协议,不要自行拼接端口。
 */
export function selectFlvUrl(sc: StreamContent): string | null {
  if (window.location.protocol === 'https:') {
    return sc.wss_flv ?? null
  }
  return sc.ws_flv ?? null
}
