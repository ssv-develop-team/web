# People-flow Analysis Service Specification

## Problem Statement

当前的人流监控能力是一个端到端联调 Demo：页面负责 WVP 登录、设备和通道选择、点播、视频播放、检测任务控制、REST 轮询以及框叠加；旁挂后端同时承担 WVP 会话代理和 YOLO 检测。这个形态适合验证链路，但不适合作为长期的实时分析运行时。

现有形态有三个直接问题：

1. 分析任务的 Interface 泄漏了 WVP 设备、通道、预览 URL 和会话细节，未来的调用方必须理解页面和 WVP BFF 的语义。
2. 检测结果目前依赖轮询和“最新框直接显示”，无法表达 `trackId`、媒体 `sourcePts`、结果顺序、断流重连和过期结果。
3. OpenCV 全帧率解码、任务生命周期、统计聚合和告警回写集中在同一 Demo 后端中，替换 GStreamer 或推理运行时会扩大变更范围。

目标系统需要为所选通道提供稳定的人流分析结果，同时保持以下已确认的展示约束：WVP/ZLM 输出 `ws_flv`，浏览器用 Jessibuca 播放原始视频，检测框绘制在独立透明层，不修改播放器的视频像素。

## Solution

建立一个暂名为 `wvp-analysis-service` 的无头实时分析服务。它只负责媒体源分析和结果发布，不负责用户界面、WVP 登录、设备目录或浏览器点播。

服务的外部 Interface 以“媒体源 + 分析任务”为中心：调用方提交一个受控的媒体源描述和分析配置，服务返回任务标识，并通过一条 WebSocket 发布 `frame`、`stats` 以及必要的生命周期消息。

WVP 控制层（现有 BFF 或后续的薄 WVP Adapter）负责登录、通道选择和点播 URL 获取；浏览器继续从 WVP/ZLM 获取 `ws_flv`。分析服务单独解码同一媒体源，在服务端完成 YOLO 检测和跟踪，只输出结构化结果。

核心 `AnalysisRuntime` 是唯一的外部 Seam。其内部可以有可替换的 `Decoder`、`Detector`、`Tracker`、`StatsAggregator`、`ResultHub` 和 `AlarmSink` Adapter，但这些 Implementation 细节不进入公共 Interface。

第一阶段使用 Python 参考 Implementation 验证协议和浏览器链路；后续把 Decoder/Inference 替换为 GStreamer 和 `wvp-ssv` 原生 Implementation，不改变外部 Interface。

## User Stories

1. 作为 WVP 操作员，我希望为选定的通道创建人流分析任务，以便查看该通道的实时人数。
2. 作为 WVP 操作员，我希望看到任务从创建、启动、运行到停止或失败的明确状态，以便判断结果是否可信。
3. 作为浏览器用户，我希望视频仍由 WVP/ZLM 的 `ws_flv` 播放，以便分析服务故障不会破坏基础视频播放。
4. 作为浏览器用户，我希望检测框显示在独立透明层，以便框的刷新、隐藏和预测不修改视频画面。
5. 作为浏览器用户，我希望框带有稳定的 `trackId`，以便同一个人在连续结果中保持身份。
6. 作为浏览器用户，我希望结果携带媒体 `sourcePts`，以便呈现层按照播放器时刻选择正确的历史结果。
7. 作为浏览器用户，我希望短暂的结果延迟可以由呈现层有限外推补偿，以便低频检测不会造成明显抖动。
8. 作为浏览器用户，我希望过期、无效或越界的框自动隐藏或裁剪，以便画面不会残留错误标记。
9. 作为浏览器用户，我希望 WebSocket 重连后能得到当前有效结果，而不是等待旧的逐帧历史回放。
10. 作为浏览器用户，我希望人数、峰值和趋势统计独立更新，以便统计面板不受视频 PTS 对齐影响。
11. 作为 WVP 控制层，我希望只需提交媒体源和关联元数据，而不必把 WVP 会话对象传入分析内核。
12. 作为系统管理员，我希望媒体源凭据以受控引用或短期授权方式传递，以便避免把长期 RTSP 密码暴露给浏览器。
13. 作为系统管理员，我希望限制同时运行的任务数、采样率和 GPU 资源，以便单个请求不会拖垮分析节点。
14. 作为系统管理员，我希望任务停止时可靠释放解码器、跟踪器和推理资源，以便重复启停不会泄漏资源。
15. 作为系统管理员，我希望服务提供存活、就绪和性能指标，以便纳入部署监控和故障诊断。
16. 作为系统管理员，我希望源流断开后有明确的重连和失败策略，以便区分暂时断流与永久错误。
17. 作为模型工程师，我希望在不修改任务协议的情况下替换 YOLO 模型或推理运行时，以便比较 CPU、ONNX Runtime 和 TensorRT 实现。
18. 作为媒体工程师，我希望在不修改浏览器和统计面板的情况下，把 OpenCV 解码替换为 GStreamer 单次解码。
19. 作为算法工程师，我希望替换 ByteTrack 实现而不改变任务生命周期和 WebSocket 发布逻辑，以便评估不同跟踪器。
20. 作为算法工程师，我希望解码器重启或 PTS 回退时能重置跟踪 generation，以便避免跨流复用错误身份。
21. 作为事件集成方，我希望告警回写通过独立 `AlarmSink` Adapter 完成，以便 WVP 告警不可用时不阻塞检测主链路。
22. 作为前端开发者，我希望使用版本化的 frame/stats Schema，以便在协议演进时获得明确的兼容策略。
23. 作为后端开发者，我希望使用 fake Decoder、Detector 和 Tracker 测试整个 Runtime，以便无需摄像头或 GPU 也能验证任务行为。
24. 作为测试人员，我希望用带已知 PTS 和断流片段的录制源进行回归测试，以便验证时间对齐、重连和过期策略。
25. 作为未来的其他消费者，我希望只订阅结构化结果而不依赖 WVP 页面，以便接入告警、报表或其他可视化应用。

## Implementation Decisions

### 任务和 HTTP Interface

- 提供创建、查询和停止任务的版本化 REST Interface。
- 创建请求包含 `source`、`analysis profile` 和不透明的 `metadata`；不包含 WVP 登录凭据、设备分页参数或浏览器预览 URL。
- 任务状态至少区分 `starting`、`running`、`degraded`、`stopping`、`stopped` 和 `failed`。
- 停止操作幂等；重复停止已经结束的任务不重新打开媒体源。
- 服务端生成 `taskId`；可选 `clientRequestId` 用于调用方幂等。
- WebSocket 连接只消费结果，不承担任务创建或 WVP 会话管理。

### WebSocket 结果协议

- 一条结果连接复用 `frame` 和 `stats` 消息，并预留 `state`、`error` 和 `eos` 类型。
- 所有消息包含 `schemaVersion`、`type` 和 `taskId`。
- `frame` 包含 `generation`、单调递增的 `seq`、媒体 `sourcePts` 和检测框列表。
- 每个框包含 `trackId`、归一化坐标 `x1/y1/x2/y2` 和 `confidence`；坐标原点为左上角，范围为 `[0,1]`，无效框不得发布。
- `sourcePts` 必须是媒体时间，协议明确单位；不得使用 wall-clock 代替媒体 PTS。内部实现可以保留更高精度的 GStreamer 时基，外部首版使用整数毫秒。
- 当 decoder generation 改变、PTS 回退或源流重启时，generation 递增，旧 generation 的跟踪身份不再延续。
- frame 使用 bounded latest-only 策略；慢客户端丢弃旧 frame，不阻塞解码和推理。stats 使用低频合并发布，不做 PTS 对齐。
- WebSocket 重连后发送当前快照和新消息，不回放无界历史；`seq` 只用于检测丢包和排序。
- `countHistory` 为有界统计窗口；`personCount`、`maxPersonCount`、`totalPersonDetections`、`sampleCount` 和 `avgConfidence` 的累计范围在 Schema 中明确。

### Runtime Module 和内部 Seam

- `AnalysisRuntime` 对外隐藏任务调度、解码、推理、跟踪、统计和发布的组合逻辑。
- `TaskSupervisor` 管理任务资源和生命周期；每个 `TaskRuntime` 独占 decoder session、tracker state 和 generation。
- `Decoder` 输出带图像句柄、宽高、媒体 PTS 和 generation 的分析样本；公共 Interface 不暴露 `cv2.VideoCapture` 或 GStreamer 对象。
- `Detector` 只返回规范化的 person detections；`Tracker` 负责身份分配和 reset。
- `StatsAggregator` 从 tracked frame 消费统计，不反向依赖 WebSocket 客户端。
- `ResultHub` 负责发布、订阅、合并和背压；推理线程不得直接操作 WebSocket。
- `AlarmSink` 是可选 Adapter。告警网络失败只能记录为 sink 状态，不得阻塞 frame/stats 主链路。

### 媒体和推理技术栈

- 控制面采用 Python 3.11/3.12、FastAPI、Pydantic v2 和 Uvicorn，复用现有 Python 测试与模型协议经验。
- OpenCV 解码仅作为首阶段参考 Implementation 和测试 Adapter；生产目标是 GStreamer 单次解码。
- `wvp-ssv` 的 C++ runner、GStreamer 插件、source metadata、最新帧调度和 TensorRT/ONNX Runtime 能力作为原生 Adapter 或 worker 依赖，不把 GTK 显示和服务器端 overlay 带入新服务。
- 推理 Interface 与模型格式解耦。Ultralytics 可用于开发验证；生产优先准备带 manifest 的 ONNX Runtime 路径，并保留 TensorRT Implementation。模型运行时和模型许可证必须在发布前单独审查。
- ByteTrack 是首版跟踪契约；不同原生 tracker 只有在满足相同身份、reset 和框语义后才能替换。

### 资源、并发和部署

- FastAPI 事件循环只负责控制和 I/O；解码、推理和 GStreamer bus 处理运行在独立 worker 线程或进程中。
- 首版采用单实例、内存态任务注册表和每任务 bounded queue；模型在 worker 级别复用，tracker 状态按任务隔离。
- 不使用 Redis、Kafka 或数据库承载浏览器 frame 实时路径。Redis 等外部系统可作为告警、审计或未来跨节点调度 Adapter。
- 提供 `/healthz`、`/readyz` 和 Prometheus 指标，至少记录活动任务、解码/推理延迟、队列丢帧、源流重连、PTS 延迟和 GPU 资源。
- 使用容器化部署；CPU、NVIDIA 等硬件差异通过显式 runtime profile 和配置处理，不在运行时静默切换到不兼容的 decoder 或推理 provider。

### 与现有项目的关系

- `wvp-ai` 保留为 Demo、参考 Python Implementation 和回归联调工具，不作为新服务的公共入口。
- `wvp-ssv` 保留为独立的原生媒体/推理实现；新服务通过稳定 Adapter 或 worker Interface 使用它，不复制出第二套隐式协议。
- `wvp-web-ui` 继续负责视频播放和 Overlay 呈现；新服务只输出结构化分析结果。
- 本 spec 不要求立即迁移、删除或重命名现有项目。

## Testing Decisions

- 测试跨越最高的外部 Seam：优先验证 `AnalysisRuntime` 和 REST/WebSocket 的外部行为，不测试具体类的私有实现细节。
- 使用 fake Source、Decoder、Detector、Tracker 和 Clock 构造确定性测试；测试必须能在无摄像头、无 GPU、无 WVP 的环境运行。
- 对 REST 任务生命周期测试创建、幂等停止、失败、重连、资源释放和并发任务隔离。
- 对 WebSocket 测试 Schema 校验、消息顺序、`seq`、generation 切换、latest-only 背压、慢客户端和重连快照。
- 对 PTS 测试有效 PTS、缺失 PTS、时间戳回退、decoder generation 改变和统计时间与媒体时间分离。
- 对 tracker 测试相邻帧身份稳定、短暂漏检、reset 后不复用旧状态和多任务隔离。
- 使用录制的 RTSP/文件样本做集成测试，覆盖 GStreamer 解码、单次解码分支和停止时资源释放。
- 复用 `wvp-ai` 现有 detector/tracker/people-flow 契约测试思路，以及 `wvp-ssv` 现有 C++ pipeline、metadata、latest-frame 和 headless runner 测试作为 prior art。
- CPU CI、NVIDIA/TensorRT 验证和真实部署节点验证分别报告，不把硬件不可用误报为代码失败。

## Out of Scope

- Vue 页面、WVP 登录页、设备/通道目录和 WVP 点播控制。
- 浏览器视频解码、`gst.wasm`、`getImageData`、`putImageData` 或服务端输出带框视频。
- 将 frame 结果写入 Redis/Kafka 作为强制中间层。
- 首版的多节点全局调度、持久化任务恢复、跨摄像头去重、跨任务 ReID 和历史报表数据库。
- 模型训练、模型标注平台和复杂告警业务规则。
- 一次性把所有 Python 代码重写为 C++，或把 `wvp-ssv` 整个仓库复制进新项目。
- 本 spec 阶段的仓库创建、代码迁移、提交、发布和生产部署。

## Further Notes

- 本 spec 的暂定项目名为 `wvp-analysis-service`；如果未来明确支持非 WVP 媒体平台，可改为更通用的名称，但不改变核心 Interface。
- 首个实现切片应先完成 Schema、fake pipeline、内存态 Runtime 和 WebSocket，再替换 Decoder/Inference Implementation。
- 需要在实现前单独形成 ADR 的问题包括：外部 PTS 精度、Python/GStreamer 与原生 worker 的进程 Seam、source credential 的授权方式、任务恢复策略和模型许可证。
- 物理拆仓应在新 Interface 通过一条端到端链路验证后进行；迁移的是已验证 Module，不是复制 Demo。
