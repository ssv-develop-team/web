import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'
import type { CommonGBChannel, Platform } from './types/wvp'

/** 上级平台分页(04 §4.9) */
export function queryPlatforms(params: {
  page: number
  count: number
  query?: string
}): Promise<PageInfo<Platform>> {
  return unwrapWvp(request.get('/api/platform/query', { params }))
}

export function queryPlatform(id: number): Promise<Platform> {
  return unwrapWvp(request.get(`/api/platform/info/${id}`))
}

export function addPlatform(data: Platform): Promise<void> {
  return unwrapWvp(request.post('/api/platform/add', data))
}

export function updatePlatform(data: Platform): Promise<void> {
  return unwrapWvp(request.post('/api/platform/update', data))
}

export function deletePlatform(id: number): Promise<void> {
  return unwrapWvp(request.delete('/api/platform/delete', { params: { id } }))
}

/** 查询平台注册状态(04 §4.9: exit/{serverGBId},官方前端按 deviceGBId 传) */
export function platformExit(deviceGbId: string): Promise<void> {
  return unwrapWvp(request.get(`/api/platform/exit/${deviceGbId}`))
}

/** 平台已分享通道(04 §4.9) */
export function queryPlatformChannels(params: {
  page: number
  count: number
  platformId: number
  query?: string
  online?: boolean
  channelType?: number
}): Promise<PageInfo<CommonGBChannel>> {
  return unwrapWvp(request.get('/api/platform/channel/list', { params }))
}

/** 批量分享通道(可 all 全量) */
export function addPlatformChannels(
  platformId: number,
  channelIds?: number[],
  all?: boolean,
): Promise<void> {
  return unwrapWvp(
    request.post('/api/platform/channel/add', { platformId, channelIds, all }),
  )
}

export function removePlatformChannels(
  platformId: number,
  channelIds?: number[],
  all?: boolean,
): Promise<void> {
  return unwrapWvp(
    request.delete('/api/platform/channel/remove', { data: { platformId, channelIds, all } }),
  )
}

/** 向平台推送已分享通道变化 */
export function pushPlatformChannels(id: number): Promise<void> {
  return unwrapWvp(request.get('/api/platform/channel/push', { params: { id } }))
}
