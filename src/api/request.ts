import axios, { type AxiosError, type AxiosResponse } from 'axios'

import type { WvpResponse } from './types/response'

/** 令牌存储键;不得写入日志/错误上报/URL(04 §6.6) */
export const TOKEN_KEY = 'access-token'

const instance = axios.create({
  baseURL: import.meta.env.VITE_WVP_BASE_URL ?? '',
  timeout: 15000,
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.set('access-token', token)
  }
  return config
})

instance.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError<WvpResponse<unknown>>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

/**
 * 拆 WVP 响应包装(04 §6.1):
 * 非 2xx 直接失败;2xx 但 code !== 0 转业务错误。
 * 二进制下载/快照图片/OpenAPI 走旁路,不要用本函数。
 */
export async function unwrapWvp<T>(promise: Promise<AxiosResponse>): Promise<T> {
  const resp = await promise
  const body = resp.data as WvpResponse<T>
  if (body.code !== 0) {
    throw new Error(`[${body.code}] ${body.msg}`)
  }
  return body.data
}

export default instance
