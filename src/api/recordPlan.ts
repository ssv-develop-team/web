import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'

/** 录制计划项(04 附录 9.8): start/stop 为半小时序号 0-47,weekDay 1-7 */
export interface RecordPlanItem {
  id?: number
  /** 从 0 点起每半小时 +1,取值 0-47 */
  start: number
  /** 同 start */
  stop: number
  /** 周几执行 1-7 */
  weekDay: number
  planId?: number
}

/** 录制计划(04 附录 9.8) */
export interface RecordPlan {
  id?: number
  name: string
  /** 关联通道数量(只读) */
  channelCount?: number
  /** 是否开启定时截图 */
  snap?: boolean
  createTime?: string
  updateTime?: string
  planItemList?: RecordPlanItem[]
}

export function queryRecordPlans(params: {
  page: number
  count: number
  query?: string
}): Promise<PageInfo<RecordPlan>> {
  return unwrapWvp(request.get('/api/record/plan/query', { params }))
}

export function getRecordPlan(id: number): Promise<RecordPlan> {
  return unwrapWvp(request.get('/api/record/plan/get', { params: { planId: id } }))
}

export function addRecordPlan(data: {
  name: string
  planItemList: RecordPlanItem[]
}): Promise<void> {
  return unwrapWvp(request.post('/api/record/plan/add', data))
}

export function updateRecordPlan(data: {
  id: number
  name: string
  planItemList: RecordPlanItem[]
}): Promise<void> {
  return unwrapWvp(request.post('/api/record/plan/update', data))
}

export function deleteRecordPlan(id: number): Promise<void> {
  return unwrapWvp(request.delete('/api/record/plan/delete', { params: { planId: id } }))
}

/** 计划关联通道(04 §4.9);allLink 全量关联 */
export function linkRecordPlan(data: {
  planId: number
  channelIds?: number[]
  deviceDbIds?: number[]
  allLink?: boolean
}): Promise<void> {
  return unwrapWvp(request.post('/api/record/plan/link', data))
}
