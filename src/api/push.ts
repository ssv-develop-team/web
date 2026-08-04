import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'

/**
 * 推流通道请求体(StreamPush extends CommonGBChannel,04 附录 9.7)。
 * 提交字段: app/stream/mediaServerId/startOfflinePush + gb* 国标映射。
 */
export interface StreamPushParam {
  id?: number
  app: string
  stream: string
  mediaServerId?: string
  /** 拉起离线推流 */
  startOfflinePush?: boolean
  /** 国标映射(继承 CommonGBChannel) */
  gbDeviceId?: string
  gbName?: string
  gbAddress?: string
  gbLongitude?: number
  gbLatitude?: number
  gbCivilCode?: string
}

export interface StreamPushItem extends StreamPushParam {
  id: number
  /** 是否正在推流 */
  pushing?: boolean
  pushTime?: string
  serverId?: string
  createTime?: string
  updateTime?: string
}

/** 推流列表(04 §4.8) */
export function queryPushes(params: {
  page: number
  count: number
  query?: string
  pushing?: boolean
  mediaServerId?: string
}): Promise<PageInfo<StreamPushItem>> {
  return unwrapWvp(request.get('/api/push/list', { params }))
}

export function addPush(data: StreamPushParam): Promise<void> {
  return unwrapWvp(request.post('/api/push/add', data))
}

export function updatePush(data: StreamPushParam & { id: number }): Promise<void> {
  return unwrapWvp(request.post('/api/push/update', data))
}

export function startPush(id: number): Promise<void> {
  return unwrapWvp(request.get('/api/push/start', { params: { id } }))
}

export function forceClosePush(id: number): Promise<void> {
  return unwrapWvp(request.get('/api/push/forceClose', { params: { id } }))
}

/** 删除单个推流(注意是 POST + query) */
export function removePush(id: number): Promise<void> {
  return unwrapWvp(request.post('/api/push/remove', null, { params: { id } }))
}

/** 批量删除 */
export function batchRemovePushes(ids: number[]): Promise<void> {
  return unwrapWvp(request.delete('/api/push/batchRemove', { data: { ids } }))
}
