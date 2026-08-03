/**
 * WVP 实体类型。
 * 字段定义来源: wvp-baseline docs/04-wvp-api-reference.md 附录 9.x +
 * vendor 源码(Device.java / CommonGBChannel.java / DeviceChannel.java)。
 * 升级 WVP 时按 04 §7 维护清单第 3 条核对更新。
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
 * 注意: 无 gb* 前缀字段为国标本体属性;deviceId 即国标通道编号(字符串),
 * 与 CommonGBChannel.gbId(整数主键)不可混用(04 §2.3)。
 */
export interface DeviceChannel extends CommonGBChannel {
  id: number
  parentDeviceId?: string
  parentName?: string
  /** 国标通道编号(字符串) */
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
  status?: string
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
