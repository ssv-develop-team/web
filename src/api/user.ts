import request, { unwrapWvp } from './request'

import type { PageInfo } from './types/response'

/** 用户(源码 storager/dao/dto/User.java) */
export interface User {
  id: number
  username: string
  /** 外部推流鉴权 sign=md5(pushKey) 用,勿写入日志(04 §6.6) */
  pushKey?: string
  createTime?: string
  updateTime?: string
  role?: { id: number; name?: string }
}

export interface Role {
  id: number
  name?: string
}

/** 用户 API Key(源码 storager/dao/dto/UserApiKey.java) */
export interface UserApiKey {
  id: number
  userId: number
  app?: string
  apiKey?: string
  /** 过期时间(毫秒),0=永不过期 */
  expiredAt?: number
  remark?: string
  enable?: boolean
  createTime?: string
  updateTime?: string
}

export function queryUsers(params: { page: number; count: number }): Promise<PageInfo<User>> {
  return unwrapWvp(request.get('/api/user/users', { params }))
}

/** 全部用户(API Key 表单下拉用) */
export function queryAllUsers(): Promise<User[]> {
  return unwrapWvp(request.get('/api/user/all'))
}

/** 添加用户;管理员专属,后端强校验(04 §4.1) */
export function addUser(data: {
  username: string
  password: string
  roleId: number
}): Promise<void> {
  return unwrapWvp(request.post('/api/user/add', null, { params: data }))
}

export function deleteUser(id: number): Promise<void> {
  return unwrapWvp(request.delete('/api/user/delete', { params: { id } }))
}

export function queryRoles(): Promise<Role[]> {
  return unwrapWvp(request.get('/api/role/all'))
}

// ---- API Key ----

export function queryApiKeys(params: {
  page: number
  count: number
}): Promise<PageInfo<UserApiKey>> {
  return unwrapWvp(request.get('/api/userApiKey/userApiKeys', { params }))
}

/** 创建 API Key;expiresAt 格式 yyyy-MM-dd HH:mm:ss,不传=永不过期 */
export function addApiKey(data: {
  userId: number
  app?: string
  remark?: string
  expiresAt?: string
  enable?: boolean
}): Promise<void> {
  return unwrapWvp(request.post('/api/userApiKey/add', null, { params: data }))
}

export function enableApiKey(id: number): Promise<void> {
  return unwrapWvp(request.post(`/api/userApiKey/enable?id=${id}`))
}

export function disableApiKey(id: number): Promise<void> {
  return unwrapWvp(request.post(`/api/userApiKey/disable?id=${id}`))
}

/** 重置密钥(生成新 apiKey) */
export function resetApiKey(id: number): Promise<void> {
  return unwrapWvp(request.post(`/api/userApiKey/reset?id=${id}`))
}

export function remarkApiKey(id: number, remark: string): Promise<void> {
  return unwrapWvp(
    request.post('/api/userApiKey/remark', null, { params: { id, remark } }),
  )
}

export function deleteApiKey(id: number): Promise<void> {
  return unwrapWvp(request.delete(`/api/userApiKey/delete?id=${id}`))
}
