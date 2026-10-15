import type {
  SsvEvidenceRecord,
  SsvEventDetail,
  SsvReviewRevision,
} from '@/api/types/ssv'

export type EvidenceReferenceState = 'available' | 'unavailable' | 'not_registered' | 'unsupported'

export interface ResolvedEvidenceReference {
  evidenceId: string
  state: EvidenceReferenceState
  record: SsvEvidenceRecord | null
}

export function eventReviews(detail: SsvEventDetail): SsvReviewRevision[] {
  return detail.review_history.filter((review) => review.event_id === detail.event.event_id)
}

export function selectCurrentReview(detail: SsvEventDetail): SsvReviewRevision | null {
  if (detail.event.current_revision === null) return null
  return eventReviews(detail).find((review) => review.revision === detail.event.current_revision) ?? null
}

export function resolveReviewEvidence(
  detail: SsvEventDetail,
  review: SsvReviewRevision | null,
): ResolvedEvidenceReference[] {
  if (!review || review.event_id !== detail.event.event_id) return []
  return review.evidence_ids.map((evidenceId) => {
    const record = detail.evidence.find(
      (candidate) => candidate.event_id === review.event_id && candidate.evidence_id === evidenceId,
    )
    if (!record) return { evidenceId, state: 'not_registered', record: null }
    if (record.status !== 'available') return { evidenceId, state: 'unavailable', record }
    if (record.kind !== 'frame') return { evidenceId, state: 'unsupported', record }
    return { evidenceId, state: 'available', record }
  })
}

export function registeredImageEvidence(detail: SsvEventDetail): SsvEvidenceRecord[] {
  return detail.evidence.filter(
    (record) => record.event_id === detail.event.event_id && record.kind === 'frame',
  )
}
