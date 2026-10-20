export interface LinkageChannel {
  deviceId: string
  channelId: string
  name: string
}

export interface LinkageEvent {
  type: 'linkage_event'
  schemaVersion: 1
  eventId: string
  sequence: number
  pointKey: string
  stationNo: number
  monitorIndex: number
  deviceName: string
  eventType: string
  property: string
  value: string
  eventTime: string
  receivedAt: string
  matchStatus: 'matched'
  channels: LinkageChannel[]
}

export type LinkageConnectionState = 'connecting' | 'connected' | 'disconnected'

export function parseLinkageEvent(value: unknown): LinkageEvent | null {
  let payload = value
  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!isRecord(payload)) return null
  if (
    payload.type !== 'linkage_event' ||
    payload.schemaVersion !== 1 ||
    payload.matchStatus !== 'matched' ||
    typeof payload.eventId !== 'string' ||
    typeof payload.sequence !== 'number' ||
    typeof payload.pointKey !== 'string' ||
    typeof payload.stationNo !== 'number' ||
    typeof payload.monitorIndex !== 'number' ||
    typeof payload.deviceName !== 'string' ||
    typeof payload.eventType !== 'string' ||
    typeof payload.property !== 'string' ||
    typeof payload.value !== 'string' ||
    typeof payload.eventTime !== 'string' ||
    typeof payload.receivedAt !== 'string' ||
    !Array.isArray(payload.channels) ||
    payload.channels.length === 0
  ) {
    return null
  }

  const channels = payload.channels.filter(isLinkageChannel)
  if (channels.length !== payload.channels.length) return null

  return {
    type: 'linkage_event',
    schemaVersion: 1,
    eventId: payload.eventId,
    sequence: payload.sequence,
    pointKey: payload.pointKey,
    stationNo: payload.stationNo,
    monitorIndex: payload.monitorIndex,
    deviceName: payload.deviceName,
    eventType: payload.eventType,
    property: payload.property,
    value: payload.value,
    eventTime: payload.eventTime,
    receivedAt: payload.receivedAt,
    matchStatus: 'matched',
    channels,
  }
}

export function createLinkageGatewayConnection(
  onEvent: (event: LinkageEvent) => void,
  onState: (state: LinkageConnectionState) => void,
) {
  let socket: WebSocket | null = null
  let reconnectTimer: number | undefined
  let reconnectAttempt = 0
  let stopped = false

  const connect = () => {
    if (stopped) return
    onState('connecting')
    try {
      const nextSocket = new WebSocket(linkageGatewayURL())
      socket = nextSocket
      nextSocket.addEventListener('open', () => {
        if (socket !== nextSocket || stopped) return
        reconnectAttempt = 0
        onState('connected')
      })
      nextSocket.addEventListener('message', (message) => {
        if (socket !== nextSocket || stopped) return
        const event = parseLinkageEvent(message.data)
        if (event) onEvent(event)
      })
      nextSocket.addEventListener('error', () => nextSocket.close())
      nextSocket.addEventListener('close', () => {
        if (socket !== nextSocket) return
        socket = null
        onState('disconnected')
        scheduleReconnect()
      })
    } catch {
      onState('disconnected')
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined) return
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt, 5))
    reconnectAttempt += 1
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined
      connect()
    }, delay)
  }

  connect()

  return {
    close() {
      stopped = true
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }
      socket?.close()
      socket = null
      onState('disconnected')
    },
  }
}

function linkageGatewayURL() {
  const configuredURL = import.meta.env.VITE_LINKAGE_GATEWAY_WS
  if (configuredURL) return configuredURL
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.hostname}:8766/ws/linkage`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLinkageChannel(value: unknown): value is LinkageChannel {
  return (
    isRecord(value) &&
    typeof value.deviceId === 'string' &&
    value.deviceId.length > 0 &&
    typeof value.channelId === 'string' &&
    value.channelId.length > 0 &&
    typeof value.name === 'string'
  )
}
