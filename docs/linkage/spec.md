# 视频联动前端规格

## 目标

在 WVP Web UI 中接入同级项目 `linkage-gateway` 的实时事件，并提供点表与视频通道绑定管理。收到绑定完成的变位事件后自动弹出实时视频；设备联动事件与 SSV 视觉事件保持独立。

## 范围

- 建立可配置的网关 WebSocket 客户端，支持断线重连和组件卸载清理。
- 仅处理 `type=linkage_event`、`schemaVersion=1`、`matchStatus=matched` 且 `channels` 非空的消息。
- 使用消息中显式的 `deviceId`、`channelId` 调用 WVP `startPlay`。
- 复用现有 Jessibuca 播放器与 HTTPS/HTTP FLV 地址选择逻辑。
- 弹窗关闭、点播失败或组件卸载时销毁播放器，并在点播已建立后调用 `stopPlay`。
- 增加视频联动配置页，展示网关点表元数据、当前 WVP 绑定和联动启用状态。
- 配置页支持从 WVP 设备及其普通视频通道中选择一个或多个绑定，并通过网关 REST API 持久化。
- 每个事件仍只自动点播 `channels[0]`；弹窗显示其他绑定数量，不实现多通道拼屏。

## 配置

- 使用 `VITE_LINKAGE_GATEWAY_WS` 显式指定 WebSocket 地址。
- 使用 `VITE_LINKAGE_GATEWAY_API` 显式指定网关 HTTP API 根地址。
- 未配置 API 地址时，从 WebSocket 地址派生 API origin；两者均未配置时使用当前页面协议、hostname 和端口 `8766`。
- 网关 `web.allowed_origins` 必须包含页面 Origin；生产 HTTPS 部署需由反向代理提供 WSS，并允许页面访问网关 REST API。

## 非目标

- 不改造 SSV API、SSV 事件页面或 `EventLedger`。
- 不由网关推断 WVP 设备与通道 ID；绑定必须由用户显式选择。
- 不自动补播断线期间的历史事件。
- 不实现多通道拼屏。

## 验收

- 配置页显示点位索引、设备语义、类型、实物 ID、联动标志及全部绑定通道。
- 可新增、编辑、停用和移除一个点位的多个 WVP 通道绑定；保存后刷新仍可读取。
- 未联动点位有明确提示；未绑定点位不会触发 WVP 点播。
- 有效事件只使用消息中显式的设备与通道 ID。
- 断线后客户端自动重连，组件卸载后不再重连。
- 弹窗能显示视频或可见错误；关闭后停止已建立的点播。
- 前端测试、类型检查和生产构建通过；不覆盖工作区已有 SSV 修改。
