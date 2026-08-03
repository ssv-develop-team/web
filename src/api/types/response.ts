/** WVP 统一响应包装(04 §2.2) */
export interface WvpResponse<T> {
  /** 0 为成功;常见业务码: 100 失败, 400 参数错误, 401 未登录, 486 设备无响应 */
  code: number
  msg: string
  data: T
}

/** 分页数据(04 §2.2):位于 data,按 list/total 消费 */
export interface PageInfo<T> {
  list: T[]
  total: number
}
