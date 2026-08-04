import request, { unwrapWvp } from './request'

/** 日志文件(04 §4.9,官方前端 fileList 结构) */
export interface LogFile {
  fileName: string
  fileSize?: number
  startTime?: string
  endTime?: string
}

/** 日志文件列表(04 §4.9);按关键字/时间过滤 */
export function queryLogFiles(params: {
  query?: string
  startTime?: string
  endTime?: string
}): Promise<LogFile[]> {
  return unwrapWvp(
    request.get('/api/log/list', {
      params: {
        query: params.query || undefined,
        startTime: params.startTime || undefined,
        endTime: params.endTime || undefined,
      },
    }),
  )
}

/** 日志文件查看地址(文本/下载,按文本消费,不走拆包) */
export function logFileUrl(fileName: string): string {
  return `/api/log/file/${fileName}`
}

/** 拉取日志文件文本内容(带 token 的旁路请求,04 §6.1) */
export async function fetchLogFileText(fileName: string): Promise<string> {
  const resp = await request.get(logFileUrl(fileName), { responseType: 'text' })
  return resp.data as string
}

/**
 * 实时日志 WebSocket(04 §4.9): 令牌作为 Sec-WebSocket-Protocol 子协议,
 * 服务端只推送,客户端不发送消息。
 */
export function createLogWebSocket(token: string): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${window.location.host}/channel/log`, [token])
}
