import request, { unwrapWvp } from './request'

/**
 * PTZ 命令(04 §4.5)。
 * 交互约定: pointerdown 发送方向命令, pointerup/失焦/组件销毁必须发 stop,
 * 否则设备可能持续转动。
 */
export type PtzCommand =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'upleft'
  | 'upright'
  | 'downleft'
  | 'downright'
  | 'zoomin'
  | 'zoomout'
  | 'stop'

/**
 * 设备原生通道 PTZ 控制(04 §4.5,参数以 PtzController 源码为准):
 * GET /api/front-end/ptz/{deviceId}/{channelId}
 *   ?command=&horizonSpeed=&verticalSpeed=&zoomSpeed=
 *
 * 注意: zoomSpeed 必须显式传 0-15,基线 2.7.4 默认值 16 会触发
 * frontEndCommand 校验错误(combindCode2 为 0-15的数字)。
 */
export function ptzControl(
  deviceId: string,
  channelId: string,
  command: PtzCommand,
  horizonSpeed = 100,
  verticalSpeed = 100,
  zoomSpeed = 5,
): Promise<void> {
  return unwrapWvp(
    request.get(`/api/front-end/ptz/${deviceId}/${channelId}`, {
      params: { command, horizonSpeed, verticalSpeed, zoomSpeed },
    }),
  )
}
