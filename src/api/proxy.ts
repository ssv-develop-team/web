import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'

/**
 * 拉流代理请求体(StreamProxy extends CommonGBChannel,源码 bean)。
 * 注意字段名与 04 附录 9.6 的 StreamProxyParam 不同:
 * add/update 控制器接收 StreamProxy,url→srcUrl、mediaServerId→relatesMediaServerId、
 * timeoutMs→timeout、rtpType→rtspType;另有国标映射 gb* 字段(见 types/wvp.ts)。
 */
export interface StreamProxyParam {
  id?: number
  /** default: 流媒体直接拉流 / ffmpeg: ffmpeg 拉流 */
  type?: 'default' | 'ffmpeg'
  app: string
  stream: string
  /** 固定选择的媒体节点 ID */
  relatesMediaServerId?: string
  /** 拉流地址 */
  srcUrl?: string
  /** 超时时间(秒) */
  timeout?: number
  /** ffmpeg 模板 KEY(type=ffmpeg 时使用) */
  ffmpegCmdKey?: string
  /** rtsp 拉流方式: 0 tcp, 1 udp, 2 组播 */
  rtspType?: string
  enable?: boolean
  enableAudio?: boolean
  enableMp4?: boolean
  enableDisableNoneReader?: boolean
  /** 国标映射(继承 CommonGBChannel) */
  gbDeviceId?: string
  gbName?: string
}

export interface StreamProxyItem extends StreamProxyParam {
  id: number
  /** 当前拉流使用的媒体节点 ID */
  mediaServerId?: string
  /** 是否正在拉流 */
  pulling?: boolean
  serverId?: string
  createTime?: string
  updateTime?: string
}

/** 拉流代理列表(04 §4.8) */
export function queryProxies(params: {
  page: number
  count: number
  query?: string
  pulling?: boolean
  mediaServerId?: string
}): Promise<PageInfo<StreamProxyItem>> {
  return unwrapWvp(request.get('/api/proxy/list', { params }))
}

export function addProxy(data: StreamProxyParam): Promise<void> {
  return unwrapWvp(request.post('/api/proxy/add', data))
}

export function updateProxy(data: StreamProxyParam & { id: number }): Promise<void> {
  return unwrapWvp(request.post('/api/proxy/update', data))
}

export function startProxy(id: number): Promise<void> {
  return unwrapWvp(request.get('/api/proxy/start', { params: { id } }))
}

export function stopProxy(id: number): Promise<void> {
  return unwrapWvp(request.get('/api/proxy/stop', { params: { id } }))
}

export function deleteProxy(id: number): Promise<void> {
  return unwrapWvp(request.delete('/api/proxy/delete', { params: { id } }))
}

/** ffmpeg 命令模板(控制器返回 Map<String,String>),key → 模板内容 */
export function queryFfmpegCmds(mediaServerId: string): Promise<Record<string, string>> {
  return unwrapWvp(
    request.get('/api/proxy/ffmpeg_cmd/list', { params: { mediaServerId } }),
  )
}
