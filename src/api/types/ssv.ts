/**
 * SSV Agent 只读 Web API DTO；不使用 WVP 响应包装或登录令牌。
 */
export type SsvEventStatus = string
export type SsvEventSeverity = string | null
export type SsvEventVerdict = string | null
export type EvidenceKind = 'frame' | 'clip'
export type EvidenceStatus = 'available' | 'unavailable'

export interface AnalysisTask {
  kind: 'review' | 'evidence_extract' | null
  state:
    | 'not_scheduled'
    | 'waiting'
    | 'queued'
    | 'processing'
    | 'lease_expired'
    | 'completed'
    | 'failed'
}

export interface SsvEventSummary {
  event_id: string
  source: string
  channel_id: string | null
  timestamp_ms: number
  event_type: string | null
  severity: SsvEventSeverity
  status: SsvEventStatus
  analysis_task: AnalysisTask
  current_revision: number | null
  verdict: SsvEventVerdict
  confidence: number | null
}

export interface SsvEventListResponse {
  items: SsvEventSummary[]
  total: number
  page: number
  page_size: number
}

export interface SsvDetectionSummary {
  class_name: string
  class_id: number
  confidence: number
  track_id: number
  track_state: string | null
  occluded: boolean
}

export interface SsvReviewRevision {
  event_id: string
  review_id: string
  revision: number
  created_ms: number
  verdict: string
  confidence: number
  evidence_status: string
  explanation: string
  evidence_ids: string[]
}

export interface SsvEvidenceRecord {
  event_id: string
  evidence_id: string
  kind: EvidenceKind
  status: EvidenceStatus
  mime_type: string | null
  size: number | null
  coverage: string | null
}

export interface SsvEventDetail {
  event: SsvEventSummary
  detections: SsvDetectionSummary[]
  review_history: SsvReviewRevision[]
  evidence: SsvEvidenceRecord[]
}
