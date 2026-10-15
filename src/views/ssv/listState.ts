import type { LocationQuery, LocationQueryRaw } from 'vue-router'

const statuses = ['pending', 'manual_review', 'completed']

export interface EventListState {
  query: string
  status: string
  channelId: string
  page: number
  pageSize: number
}

function queryString(value: LocationQuery[string] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

export function parseEventListState(query: LocationQuery): EventListState {
  const page = Number(queryString(query.page))
  const pageSize = Number(queryString(query.page_size))
  const status = queryString(query.status)
  return {
    query: queryString(query.query),
    status: statuses.includes(status) ? status : '',
    channelId: queryString(query.channel_id),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : 20,
  }
}

export function eventListQuery(state: EventListState): LocationQueryRaw {
  return {
    page: String(state.page),
    page_size: String(state.pageSize),
    ...(state.query.trim() ? { query: state.query.trim() } : {}),
    ...(state.status ? { status: state.status } : {}),
    ...(state.channelId ? { channel_id: state.channelId } : {}),
  }
}
