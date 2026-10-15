import type {
  AnalysisTask,
  SsvDetectionSummary,
  SsvEventDetail,
  SsvEventListResponse,
  SsvEventSummary,
  SsvEvidenceRecord,
  SsvReviewRevision,
} from './types/ssv'

const apiBase = '/ssv-api/api/v1'

export interface SsvEventListParams {
  channelId?: string
  query?: string
  status?: string
  page: number
  pageSize: number
}

export class SsvApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status = 0, code?: string) {
    super(message)
    this.name = 'SsvApiError'
    this.status = status
    this.code = code
  }
}

function invalidResponse(): never {
  throw new SsvApiError('SSV API 响应格式不符合事件契约')
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string') invalidResponse()
  return value
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidResponse()
  return value
}

function integer(value: unknown, minimum = 0): number {
  const result = number(value)
  if (!Number.isSafeInteger(result) || result < minimum) invalidResponse()
  return result
}

function nullable<T>(value: unknown, decode: (value: unknown) => T): T | null {
  return value === null ? null : decode(value)
}

function array<T>(value: unknown, decode: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) invalidResponse()
  return value.map(decode)
}

function analysisTask(value: unknown): AnalysisTask {
  const dto = object(value)
  const kind = nullable(dto.kind, string)
  const state = string(dto.state)
  if (kind !== null && kind !== 'review' && kind !== 'evidence_extract') invalidResponse()
  switch (state) {
    case 'not_scheduled':
    case 'waiting':
    case 'queued':
    case 'processing':
    case 'lease_expired':
    case 'completed':
    case 'failed':
      return { kind, state }
    default:
      return invalidResponse()
  }
}

function eventSummary(value: unknown): SsvEventSummary {
  const dto = object(value)
  return {
    event_id: string(dto.event_id),
    source: string(dto.source),
    channel_id: nullable(dto.channel_id, string),
    timestamp_ms: number(dto.timestamp_ms),
    event_type: nullable(dto.event_type, string),
    severity: nullable(dto.severity, string),
    status: string(dto.status),
    analysis_task: analysisTask(dto.analysis_task),
    current_revision: nullable(dto.current_revision, integer),
    verdict: nullable(dto.verdict, string),
    confidence: nullable(dto.confidence, number),
  }
}

function detection(value: unknown): SsvDetectionSummary {
  const dto = object(value)
  if (typeof dto.occluded !== 'boolean') invalidResponse()
  return {
    class_name: string(dto.class_name),
    class_id: number(dto.class_id),
    confidence: number(dto.confidence),
    track_id: number(dto.track_id),
    track_state: nullable(dto.track_state, string),
    occluded: dto.occluded,
  }
}

function review(value: unknown): SsvReviewRevision {
  const dto = object(value)
  return {
    event_id: string(dto.event_id),
    review_id: string(dto.review_id),
    revision: integer(dto.revision),
    created_ms: number(dto.created_ms),
    verdict: string(dto.verdict),
    confidence: number(dto.confidence),
    evidence_status: string(dto.evidence_status),
    explanation: string(dto.explanation),
    evidence_ids: array(dto.evidence_ids, string),
  }
}

function evidence(value: unknown): SsvEvidenceRecord {
  const dto = object(value)
  const kind = string(dto.kind)
  const status = string(dto.status)
  if (kind !== 'frame' && kind !== 'clip') invalidResponse()
  if (status !== 'available' && status !== 'unavailable') invalidResponse()
  return {
    event_id: string(dto.event_id),
    evidence_id: string(dto.evidence_id),
    kind,
    status,
    mime_type: nullable(dto.mime_type, string),
    size: nullable(dto.size, integer),
    // coverage 在服务端模型中可省略，统一映射为 null。
    coverage: nullable(dto.coverage ?? null, string),
  }
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    if (signal?.aborted || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')) throw error
    throw new SsvApiError('无法连接 SSV 事件服务')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (cause) {
    if (signal?.aborted || (typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError')) throw cause
    if (response.ok) invalidResponse()
  }
  if (!response.ok) {
    const errorBody = body && typeof body === 'object' ? body as Record<string, unknown> : null
    const error = errorBody?.error && typeof errorBody.error === 'object'
      ? errorBody.error as Record<string, unknown>
      : null
    const message = error?.message ?? errorBody?.message
    throw new SsvApiError(
      typeof message === 'string' ? message : `请求失败（HTTP ${response.status}）`,
      response.status,
      typeof error?.code === 'string' ? error.code : undefined,
    )
  }
  return body
}

export async function fetchSsvEvents(
  options: SsvEventListParams,
  signal?: AbortSignal,
): Promise<SsvEventListResponse> {
  const params = new URLSearchParams({
    page: String(options.page),
    page_size: String(options.pageSize),
  })
  if (options.channelId) params.set('channel_id', options.channelId)
  if (options.query?.trim()) params.set('query', options.query.trim())
  if (options.status) params.set('status', options.status)
  const dto = object(await getJson(`${apiBase}/events?${params.toString()}`, signal))
  return {
    items: array(dto.items, eventSummary),
    total: integer(dto.total),
    page: integer(dto.page, 1),
    page_size: integer(dto.page_size, 1),
  }
}

export async function fetchSsvEventDetail(
  eventId: string,
  signal?: AbortSignal,
): Promise<SsvEventDetail> {
  const dto = object(await getJson(
    `${apiBase}/events/${encodeURIComponent(eventId)}`,
    signal,
  ))
  const event = eventSummary(dto.event)
  if (event.event_id !== eventId) invalidResponse()
  return {
    event,
    detections: array(dto.detections, detection),
    review_history: array(dto.review_history, review),
    evidence: array(dto.evidence, evidence),
  }
}

export function ssvEvidenceImageUrl(eventId: string, evidenceId: string): string {
  return `${apiBase}/events/${encodeURIComponent(eventId)}/evidence/${encodeURIComponent(evidenceId)}/image`
}
