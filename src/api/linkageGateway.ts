import axios from 'axios'

export interface LinkagePoint {
  pointKey: string
  stationNo: number
  monitorIndex: number
  deviceName: string
  deviceType: string
  physicalId: string
  linkageEnabled: boolean
  importId: number
  updatedAt: string
}

export interface LinkageBinding {
  pointKey: string
  deviceId: string
  channelId: string
  name: string
  enabled: boolean
  displayOrder: number
}

export type LinkageBindingInput = Omit<LinkageBinding, 'pointKey'>

const gatewayClient = axios.create({ timeout: 15000 })

export function listLinkagePoints(): Promise<LinkagePoint[]> {
  return gatewayClient
    .get<LinkagePoint[]>('/api/v1/linkage/points', { baseURL: getLinkageGatewayApiBaseURL() })
    .then((response) => response.data)
}

export function listLinkageBindings(): Promise<LinkageBinding[]> {
  return gatewayClient
    .get<LinkageBinding[]>('/api/v1/linkage/bindings', { baseURL: getLinkageGatewayApiBaseURL() })
    .then((response) => response.data)
}

export function replaceLinkageBindings(
  pointKey: string,
  bindings: LinkageBindingInput[],
): Promise<LinkageBinding[]> {
  return gatewayClient
    .put<LinkageBinding[]>(
      `/api/v1/linkage/bindings/${encodeURIComponent(pointKey)}`,
      { bindings },
      { baseURL: getLinkageGatewayApiBaseURL() },
    )
    .then((response) => response.data)
}

export function getLinkageGatewayApiBaseURL(): string {
  const configuredURL = import.meta.env.VITE_LINKAGE_GATEWAY_API
  if (configuredURL) return configuredURL.replace(/\/+$/, '')

  const configuredWebSocketURL = import.meta.env.VITE_LINKAGE_GATEWAY_WS
  if (configuredWebSocketURL) {
    const url = new URL(configuredWebSocketURL)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    return url.origin
  }

  const scheme = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${scheme}//${window.location.hostname}:8766`
}
