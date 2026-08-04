import request, { unwrapWvp } from './request'

import type { MediaServer } from './types/wvp'

/** 媒体节点列表(04 §4.8) */
export function queryMediaServers(): Promise<MediaServer[]> {
  return unwrapWvp(request.get('/api/server/media_server/list'))
}

export function queryMediaServer(id: string): Promise<MediaServer> {
  return unwrapWvp(request.get(`/api/server/media_server/one/${id}`))
}

/** 新增/更新媒体节点(04 §4.8) */
export function saveMediaServer(server: MediaServer): Promise<void> {
  return unwrapWvp(request.post('/api/server/media_server/save', server))
}

export function deleteMediaServer(id: string): Promise<void> {
  return unwrapWvp(request.delete('/api/server/media_server/delete', { params: { id } }))
}

/** 连通性检查(官方前端参数: port 对应 HTTP 端口) */
export function checkMediaServer(params: {
  ip: string
  port: number
  secret: string
  type: string
}): Promise<void> {
  return unwrapWvp(request.get('/api/server/media_server/check', { params }))
}
