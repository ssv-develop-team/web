import { md5 } from 'js-md5'

import request, { unwrapWvp } from './request'

/** 登录响应(04 §2.1):data.accessToken 写入 access-token 头 */
export interface LoginResponse {
  accessToken: string
  username: string
  serverId: string
}

/** /api/user/userInfo 返回 LoginUser(源码: conf/security/dto/LoginUser) */
export interface UserInfo {
  user: {
    id: number
    username: string
    pushKey?: string
    createTime?: string
    updateTime?: string
    role?: { id: number; name: string; authority?: string[] }
  }
  accessToken?: string
  serverId?: string
  loginTime?: string
}

/** 登录;password 传明文,内部按 32 位小写 MD5 计算(04 §2.1) */
export function login(username: string, password: string): Promise<LoginResponse> {
  return unwrapWvp(
    request.get('/api/user/login', { params: { username, password: md5(password) } }),
  )
}

/** 当前登录用户 */
export function userInfo(): Promise<UserInfo> {
  return unwrapWvp(request.post('/api/user/userInfo'))
}
