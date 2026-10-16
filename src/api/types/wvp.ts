/**
 * WVP 实体类型。
 * 字段定义来源: 当前运行 WVP OpenAPI 与 wvp-baseline vendor 源码。
 * 升级 WVP 时同时核对运行时 DTO 与基线 DTO 的字段语义。
 */

/** 国标设备(04 附录 9.2) */
export interface Device {
  id: number
  /** 设备国标编号 */
  deviceId: string
  name?: string
  manufacturer?: string
  model?: string
  firmware?: string
  /** UDP / TCP */
  transport?: string
  /** UDP / TCP-ACTIVE / TCP-PASSIVE */
  streamMode?: string
  ip?: string
  port: number
  hostAddress?: string
  /** 是否在线 */
  onLine: boolean
  registerTimeStamp?: number
  keepaliveTimeStamp?: number
  /** 心跳间隔秒,缺省 60 */
  heartBeatInterval: number
  /** 心跳超时次数,缺省 3 */
  heartBeatCount: number
  /** 0 不支持,1 GPS,2 北斗 */
  positionCapability?: number
  channelCount: number
  /** 注册有效期(秒) */
  expires: number
  createTime?: string
  updateTime?: string
  /** 设备使用的媒体节点 ID,默认 null */
  mediaServerId?: string
  /** UTF-8 / GB2312 */
  charset?: string
  /** 目录订阅周期(秒),0 不订阅 */
  subscribeCycleForCatalog: number
  /** 移动位置订阅周期,0 不订阅 */
  subscribeCycleForMobilePosition: number
  /** 位置上报间隔秒,默认 5 */
  mobilePositionSubmissionInterval: number
  /** 报警订阅周期,0 不订阅 */
  subscribeCycleForAlarm: number
  /** SSRC 校验(防串流),默认 false */
  ssrcCheck: boolean
  /** WGS84 / GCJ02,保留字段 */
  geoCoordSys?: string
  password?: string
  /** 收流 IP */
  sdpIp?: string
  /** SIP 交互 IP(设备访问平台的 IP) */
  localIp?: string
  asMessageChannel: boolean
  broadcastPushAfterAck: boolean
  serverId?: string
}

/** 统一通道(04 附录 9.3);gbId 即通用通道整数主键 */
export interface CommonGBChannel {
  gbId: number
  /** 国标编码 */
  gbDeviceId: string
  gbName?: string
  gbManufacturer?: string
  gbModel?: string
  gbOwner?: string
  gbCivilCode?: string
  gbBlock?: string
  gbAddress?: string
  /** 是否有子设备 */
  gbParental?: number
  gbParentId?: string
  gbSafetyWay?: number
  /** 注册方式 1-4 */
  gbRegisterWay?: number
  gbCertNum?: string
  gbCertifiable?: number
  gbErrCode?: number
  gbEndTime?: string
  /** 0 不涉密,1 涉密 */
  gbSecrecy?: number
  gbIpAddress?: string
  gbPort?: number
  gbPassword?: string
  /** ON / OFF */
  gbStatus?: string
  gbLongitude?: number
  gbLatitude?: number
  gpsAltitude?: number
  gpsSpeed?: number
  gpsDirection?: number
  gpsTime?: string
  gbBusinessGroupId?: string
  /** 1 球机,2 半球,3 固定枪机,4 遥控枪机,5 遥控半球,6 多目全景,7 多目分割,99 移动,98 会议 */
  gbPtzType?: number
  gbPositionType?: number
  gbRoomType?: number
  gbUseType?: number
  gbSupplyLightType?: number
  gbDirectionType?: number
  gbResolution?: string
  gbDownloadSpeed?: string
  gbSvcSpaceSupportMod?: number
  gbSvcTimeSupportMode?: number
  /** 半小时粒度录制计划位图,只读 */
  recordPLan?: number
  dataType?: number
  dataDeviceId?: number
  createTime?: string
  updateTime?: string
  /** 存在表示正在直播 */
  streamId?: string
  /** 1 支持对讲,0 不支持 */
  enableBroadcast?: number
  mapLevel?: number
}

/**
 * 设备下通道(DeviceChannel extends CommonGBChannel,源码 bean 同构)。
 * 注意: GitHub 基线使用 deviceId 表示通道编号；当前 Docker WVP 使用
 * channelId 表示通道编号、deviceId 表示所属设备编号。调用播放类接口前
 * 必须通过 getWvpChannelId() 取得通道编号，不能使用 gbId。
 */
export interface DeviceChannel extends CommonGBChannel {
  id: number
  parentDeviceId?: string
  parentName?: string
  /** 当前 Docker WVP 的通道国标编号 */
  channelId?: string
  /** GitHub 基线中的通道编号；当前 Docker WVP 中表示所属设备编号 */
  deviceId?: string
  name?: string
  manufacturer?: string
  model?: string
  owner?: string
  civilCode?: string
  block?: string
  address?: string
  parental?: number
  parentId?: string
  safetyWay?: number
  registerWay?: number
  certNum?: string
  certifiable?: number
  errCode?: number
  endTime?: string
  secrecy?: number
  ipAddress?: string
  port?: number
  password?: string
  status?: string | boolean
  longitude?: number
  latitude?: number
  ptzType?: number
  ptzTypeText?: string
  positionType?: number
  roomType?: number
  useType?: number
  supplyLightType?: number
  directionType?: number
  resolution?: string
  businessGroupId?: string
  downloadSpeed?: string
  svcSpaceSupportMod?: number
  svcTimeSupportMode?: number
  /** 子设备数 */
  subCount: number
  hasAudio: boolean
  gpsTime?: string
  /** 码流标识,可选: stream/streamnumber/streamprofile/streamMode */
  streamIdentification?: string
  /** 0 普通通道,1 行政区划,2 业务分组/虚拟组织 */
  channelType: number
  dataType?: number
}

/**
 * 取得 WVP 通道的国标编号。
 * 当前 Docker WVP 使用 channelId；仅在检测到 GitHub 基线的
 * parentDeviceId 字段时，才回退使用 deviceId。
 */
export function getWvpChannelId(
  channel: Pick<DeviceChannel, 'channelId' | 'deviceId' | 'parentDeviceId'>,
): string | undefined {
  const channelId = channel.channelId?.trim()
  if (channelId) return channelId
  if (channel.parentDeviceId?.trim()) return channel.deviceId?.trim()
  return undefined
}

/** 上级平台/国标级联(04 附录 9.4);提交前必须完整校验(04 §4.9) */
export interface Platform {
  id?: number
  enable: boolean
  name: string
  /** SIP 服务国标编码 */
  serverGBId: string
  /** SIP 服务国标域 */
  serverGBDomain: string
  serverIp: string
  serverPort: number
  /** 设备国标编号(本平台对上注册身份) */
  deviceGBId: string
  deviceIp: string
  devicePort: number
  /** SIP 认证用户名,默认用 deviceGBId */
  username?: string
  password?: string
  /** 注册周期(秒) */
  expires?: number
  /** 心跳周期(秒) */
  keepTimeout?: number
  /** UDP / TCP */
  transport?: string
  /** UTF-8 / GB2312 */
  characterSet?: string
  /** 允许云台控制 */
  ptz?: boolean
  /** RTCP 流保活 */
  rtcp?: boolean
  /** 在线状态(只读) */
  status?: boolean
  /** 通道数量(只读) */
  channelCount?: number
  /** 已订阅目录(只读) */
  catalogSubscribe?: boolean
  /** 已订阅报警(只读) */
  alarmSubscribe?: boolean
  /** 已订阅移动位置(只读) */
  mobilePositionSubscribe?: boolean
  /** 目录分组:每包通道数量 1/2/4/8 */
  catalogGroup?: number
  createTime?: string
  updateTime?: string
  asMessageChannel?: boolean
  /** 点播回复 200 OK 使用的 IP */
  sendStreamIp?: string
  autoPushChannel?: boolean
  /** 目录包含平台信息 0/1 */
  catalogWithPlatform?: number
  /** 目录包含分组信息 0/1 */
  catalogWithGroup?: number
  /** 目录包含行政区划 0/1 */
  catalogWithRegion?: number
  civilCode?: string
  manufacturer?: string
  model?: string
  address?: string
  /** 注册方式 1-4,缺省 1 */
  registerWay?: number
  /** 保密属性 0/1,缺省 0 */
  secrecy?: number
  serverId?: string
}

/** 媒体节点(04 附录 9.5) */
export interface MediaServer {
  id?: string
  ip: string
  /** hook 使用的 IP(ZLM 访问 WVP 的 IP),默认 127.0.0.1 */
  hookIp?: string
  sdpIp?: string
  streamIp?: string
  httpPort: number
  httpSSlPort?: number
  rtmpPort?: number
  flvPort?: number
  flvSSLPort?: number
  mp4Port?: number
  wsFlvPort?: number
  wsFlvSSLPort?: number
  rtmpSSlPort?: number
  /** RTP 收流端口(单端口模式) */
  rtpProxyPort?: number
  /** 1078 收流端口(单端口模式) */
  jttProxyPort?: number
  rtspPort?: number
  rtspSSLPort?: number
  /** 是否自动配置 ZLM,默认 true */
  autoConfig?: boolean
  /** ZLM 鉴权参数,勿写入日志(04 §6.6) */
  secret?: string
  /** 状态(只读): 是否在线 */
  status?: boolean
  hookAliveInterval?: number
  /** 是否多端口模式,默认 false */
  rtpEnable?: boolean
  /** 多端口 RTP 收流端口范围,默认 30000,30500 */
  rtpPortRange?: string
  sendRtpPortRange?: string
  /** assist 服务端口,默认 0(关闭) */
  recordAssistPort?: number
  createTime?: string
  updateTime?: string
  lastKeepaliveTime?: string
  defaultServer?: boolean
  /** 录像存储时长(天) */
  recordDay?: number
  recordPath?: string
  /** zlm / abl */
  type?: string
  transcodeSuffix?: string
  serverId?: string
}
