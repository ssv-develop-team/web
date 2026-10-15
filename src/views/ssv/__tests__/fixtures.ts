import type {
  SsvEventDetail,
  SsvEventSummary,
  SsvEvidenceRecord,
  SsvReviewRevision,
} from '@/api/types/ssv'

export function summary(eventId = 'event-one'): SsvEventSummary {
  return {
    event_id: eventId,
    source: 'source-one',
    channel_id: '34020000001320000001',
    timestamp_ms: 1728882000000,
    event_type: '进入区域',
    severity: 'high',
    status: 'completed',
    analysis_task: { kind: 'review', state: 'completed' },
    current_revision: 2,
    verdict: 'violation',
    confidence: 0.91,
  }
}

export function review(eventId: string, revision: number): SsvReviewRevision {
  return {
    event_id: eventId,
    review_id: `${eventId}-review-${revision}`,
    revision,
    created_ms: 1728882000000 + revision,
    verdict: revision === 1 ? 'uncertain' : 'violation',
    confidence: revision === 1 ? 0.3 : 0.91,
    evidence_status: 'available',
    explanation: `结论解释 ${eventId} R${revision}`,
    evidence_ids: revision === 1 ? ['frame-one'] : ['frame-two', 'unavailable', 'missing', 'clip-one', 'foreign-only'],
  }
}

export function evidence(eventId: string, id: string): SsvEvidenceRecord {
  return {
    event_id: eventId,
    evidence_id: id,
    kind: 'frame',
    status: 'available',
    mime_type: 'image/png',
    size: 1024,
    coverage: 'anchor',
  }
}

export function detail(eventId = 'event-one'): SsvEventDetail {
  return {
    event: summary(eventId),
    detections: [{ class_name: 'person', class_id: 0, track_id: 7, track_state: 'tracked', occluded: true, confidence: 0.88 }],
    // 顺序、创建时间和外事件记录故意与当前修订不同，防止按这些值回退。
    review_history: [review(eventId, 2), review('other-event', 5), { ...review(eventId, 1), created_ms: 1728999999999 }],
    evidence: [
      evidence(eventId, 'frame-one'),
      evidence(eventId, 'frame-two'),
      { ...evidence(eventId, 'unavailable'), status: 'unavailable' },
      { ...evidence(eventId, 'clip-one'), kind: 'clip', mime_type: 'video/mp4' },
      evidence('other-event', 'foreign-only'),
      evidence(eventId, 'unreferenced'),
    ],
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
