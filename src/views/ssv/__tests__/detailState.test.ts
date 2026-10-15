import { describe, expect, it } from 'vitest'

import {
  eventReviews,
  registeredImageEvidence,
  resolveReviewEvidence,
  selectCurrentReview,
} from '../detailState'
import { detail } from './fixtures'

describe('SSV 事件详情关联', () => {
  it('当前修订只按 event_id + revision 精确匹配', () => {
    const value = detail()
    expect(selectCurrentReview(value)?.review_id).toBe('event-one-review-2')
    value.event.current_revision = 9
    expect(selectCurrentReview(value)).toBeNull()
    value.event.current_revision = null
    expect(selectCurrentReview(value)).toBeNull()
  })

  it('不会把其他事件的复核或证据记录纳入当前事件', () => {
    const value = detail()
    expect(eventReviews(value).map((review) => review.event_id)).toEqual(['event-one', 'event-one'])
    const references = resolveReviewEvidence(value, eventReviews(value)[0] ?? null)
    expect(references.map((reference) => [reference.evidenceId, reference.state])).toEqual([
      ['frame-two', 'available'],
      ['unavailable', 'unavailable'],
      ['missing', 'not_registered'],
      ['clip-one', 'unsupported'],
      ['foreign-only', 'not_registered'],
    ])
  })

  it('图库展示当前事件全部 frame，包含不可用和未被修订引用的登记项', () => {
    const images = registeredImageEvidence(detail())
    expect(images.map((image) => image.evidence_id)).toEqual([
      'frame-one',
      'frame-two',
      'unavailable',
      'unreferenced',
    ])
  })
})
