import request, { unwrapWvp } from '@/api/request'

export interface SsvWvpChannelOption {
  /** GB channel ID from the deployed WVP API's `channelId` field. */
  gbDeviceId: string
  gbName?: string
}

interface WvpPage<T> {
  total: number
  list: T[]
}

interface WvpDeviceDto {
  deviceId?: string
}

interface WvpChannelDto {
  /** The deployed WVP API identifies a channel by this GB ID. */
  channelId?: string
  name?: string
  /** 0 = GB channel, 1 = live stream, 2 = virtual group. */
  channelType?: number
}

const PAGE_SIZE = 100
const DEVICE_CONCURRENCY = 8

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    throw error
  }
}

function getWvpPage<T>(
  path: string,
  params: Record<string, string | number | boolean>,
  signal?: AbortSignal,
): Promise<WvpPage<T>> {
  return unwrapWvp<WvpPage<T>>(request.get(path, { params, signal }))
}

async function getAllPages<T>(
  loadPage: (page: number) => Promise<WvpPage<T>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const firstPage = await loadPage(1)
  const items = [...firstPage.list]
  const totalPages = Math.ceil(firstPage.total / PAGE_SIZE)

  for (let page = 2; page <= totalPages; page += 1) {
    throwIfAborted(signal)
    const response = await loadPage(page)
    if (!response.list.length) break
    items.push(...response.list)
    if (items.length >= firstPage.total) break
  }

  return items
}

async function getDevices(status: boolean, signal?: AbortSignal): Promise<WvpDeviceDto[]> {
  return getAllPages(
    (page) =>
      getWvpPage<WvpDeviceDto>(
        '/api/device/query/devices',
        { page, count: PAGE_SIZE, query: '', status },
        signal,
      ),
    signal,
  )
}

async function getChannelsForDevice(
  deviceId: string,
  signal?: AbortSignal,
): Promise<WvpChannelDto[]> {
  const path = `/api/device/query/devices/${encodeURIComponent(deviceId)}/channels`
  return getAllPages(
    (page) =>
      getWvpPage<WvpChannelDto>(path, { page, count: PAGE_SIZE, channelType: false }, signal),
    signal,
  )
}

async function getChannelsForDevices(
  deviceIds: string[],
  signal?: AbortSignal,
): Promise<WvpChannelDto[]> {
  const channels: WvpChannelDto[] = []

  for (let offset = 0; offset < deviceIds.length; offset += DEVICE_CONCURRENCY) {
    throwIfAborted(signal)
    const batch = deviceIds.slice(offset, offset + DEVICE_CONCURRENCY)
    const results = await Promise.all(
      batch.map((deviceId) => getChannelsForDevice(deviceId, signal)),
    )
    channels.push(...results.flat())
  }

  return channels
}

/**
 * Adapts the deployed WVP 3.x device/channel DTOs into stable channel options
 * for the SSV event filter. The API's `channelId` is the GB channel ID;
 * its integer database `id` is deliberately not exposed here.
 */
export async function querySsvWvpChannelDirectory(
  signal?: AbortSignal,
): Promise<SsvWvpChannelOption[]> {
  const [onlineDevices, offlineDevices] = await Promise.all([
    getDevices(true, signal),
    getDevices(false, signal),
  ])
  const deviceIds = [
    ...new Set(
      [...onlineDevices, ...offlineDevices]
        .map((device) => device.deviceId?.trim())
        .filter((deviceId): deviceId is string => Boolean(deviceId)),
    ),
  ]

  const channels = await getChannelsForDevices(deviceIds, signal)
  const optionsByGbId = new Map<string, SsvWvpChannelOption>()

  for (const channel of channels) {
    if (channel.channelType !== undefined && channel.channelType !== 0) continue
    const gbDeviceId = channel.channelId?.trim()
    if (!gbDeviceId) continue
    optionsByGbId.set(gbDeviceId, {
      gbDeviceId,
      gbName: channel.name || undefined,
    })
  }

  return [...optionsByGbId.values()]
}
