import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'
import type { CommonGBChannel } from './types/wvp'

/** 统一通道库分页查询(04 §4.3);channelId 为整数主键 */
export interface QueryCommonChannelsParams {
  page: number
  count: number
  query?: string
  online?: boolean
  hasRecordPlan?: boolean
  /** 0 普通通道,1 行政区划,2 业务分组/虚拟组织 */
  channelType?: number
  civilCode?: string
  parentDeviceId?: string
}

export function queryCommonChannels(
  params: QueryCommonChannelsParams,
): Promise<PageInfo<CommonGBChannel>> {
  return unwrapWvp(request.get('/api/common/channel/list', { params }))
}

/** 单个统一通道 */
export function queryCommonChannel(id: number): Promise<CommonGBChannel> {
  return unwrapWvp(request.get('/api/common/channel/one', { params: { id } }))
}
