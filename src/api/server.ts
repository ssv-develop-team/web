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

/** 服务信息(04 §4.8): 硬件信息/操作系统/平台信息等分组 */
export interface ServerInfo {
  硬件信息?: Record<string, string>
  操作系统?: Record<string, string>
  平台信息?: Record<string, string>
  [key: string]: unknown
}

export function queryServerInfo(): Promise<ServerInfo> {
  return unwrapWvp(request.get('/api/server/info'))
}

/** 系统采样(cpu/mem/net 为时间序列,可能为空) */
export interface SystemInfo {
  cpu: number[]
  mem: number[]
  net: number[]
  netTotal: number
  disk: unknown
}

export function querySystemInfo(): Promise<SystemInfo> {
  return unwrapWvp(request.get('/api/server/system/info'))
}

/** 媒体节点负载(04 §4.8) */
export interface MediaServerLoad {
  id: string
  push: number
  proxy: number
  gbReceive: number
  gbSend: number
}

export function queryMediaServerLoad(): Promise<MediaServerLoad[]> {
  return unwrapWvp(request.get('/api/server/media_server/load'))
}
