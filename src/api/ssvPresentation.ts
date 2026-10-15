import type {
  SsvEventSeverity,
  SsvEventStatus,
  SsvEventVerdict,
} from './types/ssv'

export function formatSsvTimestamp(value: number): string {
  if (!Number.isFinite(value)) return '时间未提供'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未提供'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatSsvConfidence(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '未提供'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value)
}

export function ssvStatusLabel(status: SsvEventStatus): string {
  switch (status) {
    case 'pending':
      return '待处理'
    case 'manual_review':
      return '需人工复核'
    case 'completed':
      return '已完成'
    default:
      return `未知状态 · ${status}`
  }
}

export function ssvStatusTagType(
  status: SsvEventStatus,
): 'success' | 'warning' | 'info' | 'danger' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'manual_review':
      return 'warning'
    case 'pending':
      return 'info'
    default:
      return 'danger'
  }
}

export function ssvVerdictLabel(verdict: SsvEventVerdict): string {
  switch (verdict) {
    case 'violation':
      return '违规'
    case 'compliant':
      return '符合'
    case 'uncertain':
      return '不确定'
    case null:
      return '未形成结论'
    default:
      return `未知判定 · ${verdict}`
  }
}

export function ssvSeverityTagType(
  severity: SsvEventSeverity,
): 'danger' | 'warning' | 'success' | 'info' {
  switch (severity) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'success'
    default:
      return 'info'
  }
}

export function ssvTaskStateLabel(state: string): string {
  switch (state) {
    case 'not_scheduled':
      return '未安排'
    case 'waiting':
      return '等待中'
    case 'queued':
      return '已排队'
    case 'processing':
      return '租约有效'
    case 'lease_expired':
      return '租约已过期'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return `未知任务状态 · ${state}`
  }
}

export function ssvTaskTagType(
  state: string,
): 'success' | 'warning' | 'info' | 'danger' {
  switch (state) {
    case 'completed':
      return 'success'
    case 'failed':
    case 'lease_expired':
      return 'danger'
    case 'processing':
    case 'queued':
    case 'waiting':
      return 'warning'
    default:
      return 'info'
  }
}

export function ssvEvidenceStatusLabel(status: string): string {
  return status === 'missing' ? '缺少结论证据' : status
}

export function formatSsvSize(size: number | null): string {
  if (size === null || !Number.isFinite(size) || size < 0) return '大小未提供'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
