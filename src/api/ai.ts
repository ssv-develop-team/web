import axios from 'axios'

import type { StreamContent } from '@/player/stream'

/** YOLO 检测到的人形框(像素坐标,可选置信度) */
export interface PersonBox {
  x1: number
  y1: number
  x2: number
  y2: number
  confidence?: number
}

/** wvp-ai 检测任务状态(与后端 DetectionTask 序列化字段一致) */
export interface AIDetectionTask {
  taskId: string
  deviceId: string
  channelDeviceId: string
  channelId: number
  channelName: string
  wvpStreamInfo?: Record<string, unknown> | null
  previewUrl?: string | null
  detectStreamUrl?: string | null
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'failed' | string
  startedAt?: number | null
  lastFrameAt?: number | null
  lastDetectionAt?: number | null
  lastReportAt?: number | null
  lastConfidence?: number | null
  lastDetectionBox?: PersonBox | null
  lastSnapPath?: string | null
  lastError?: string | null
  lastReportSuccess?: boolean | null
  lastReportError?: string | null
  /** 最近一帧检测到的人数 */
  personCount: number
  /** 最近一帧的人形框 */
  boxes: PersonBox[]
  maxPersonCount: number
  totalPersonDetections: number
  sampleCount: number
  detectedSampleCount: number
  avgConfidence?: number | null
  countHistory: Array<{ at: number; count: number }>
}

export interface StartTaskPayload {
  deviceId: string
  channelDeviceId: string
  channelId: number
  channelName: string
  previewUrl?: string
  detectStreamUrl?: string
  wvpStreamInfo?: Record<string, unknown>
}

/**
 * wvp-ai 旁挂服务客户端。
 * 基地址用 VITE_AI_BASE_URL 配置,默认本机 18000(与 wvp-ai Makefile 一致)。
 */
const aiRequest = axios.create({
  baseURL: import.meta.env.VITE_AI_BASE_URL ?? 'http://127.0.0.1:18000',
  timeout: 30000,
})

export function listTasks(): Promise<AIDetectionTask[]> {
  return aiRequest.get('/api/tasks').then((resp) => resp.data)
}

export function getTask(taskId: string): Promise<AIDetectionTask> {
  return aiRequest.get(`/api/tasks/${taskId}`).then((resp) => resp.data)
}

export function startTask(payload: StartTaskPayload): Promise<AIDetectionTask> {
  return aiRequest.post('/api/tasks/start', payload).then((resp) => resp.data)
}

export function stopTask(taskId: string): Promise<AIDetectionTask> {
  return aiRequest.post(`/api/tasks/${taskId}/stop`).then((resp) => resp.data)
}

/**
 * 从 WVP 点播结果中挑选后端解码检测用的流地址:
 * 优先 RTSP/RTMP,最后才用 HTTP-FLV(OpenCV 无法直接打开 ws_flv)。
 */
export function selectDetectUrl(sc: StreamContent): string | null {
  return sc.rtsp ?? sc.rtmp ?? sc.flv ?? sc.ws_flv ?? null
}
