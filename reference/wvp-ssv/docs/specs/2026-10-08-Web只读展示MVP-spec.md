# Web 只读展示 MVP 规格

## 目标

给单机部署提供一个轻量浏览器界面，用于查看 SSV 已入账事件、复核结论、检测记录和已登记证据。界面展示数据以 SQLite `EventLedger` 为准；事件、复核版本和证据之间分别通过 `event_id`、`revision`、`evidence_id` 关联。

## 当前能力与边界

本次设计开始前，项目已有 GStreamer C++ 视频分析和事件发布链路，以及 Python Agent、SQLite 事件账本、异步复核、证据提取和 Markdown 报告，尚无自有 Web UI 或 HTTP 查询 API。Web MVP 只展示账本中登记的事件图片（`kind=frame`），不接入视频片段（`kind=clip`）。

`SsvEventStore` 面向 Agent 写入流程，初始化时会创建父目录、启用 WAL 并迁移 schema。Web 查询端必须使用独立只读 SQLite 连接，不能通过构造 `SsvEventStore` 读取账本。

## 范围

- 单站点、单实例、只读查询，不区分租户。
- 概览页显示账本内事件总数、待处理数、已完成数、需关注数和最近事件时间；数据是账本累计状态，不代表当天统计或 runner 在线状态。
- 事件列表支持按关键词、来源、状态、结论和时间范围过滤，并分页。
- 事件详情分别展示当前最新复核结论、按 revision 排序的复核历史、检测记录、可用图片证据和原始事件字段。
- 复核结论及 claim 中的 `evidence_ids` 可切换到同一事件下对应的主预览；不存在的引用保留 ID 并标记未登记，已登记但不可用的证据显示不可用状态。
- 仅 `frame` 图片证据可在详情中预览和切换；`clip` 视频片段不在 Web API 中开放，也不显示视频播放器。
- 页面定期刷新概览、列表和当前打开的详情，使用简单轮询，不建立 WebSocket 或 SSE 通道。
- UI 同源提供静态资源与 JSON API，不配置跨域访问。

## 非本阶段范围

- 多租户、账号、角色、权限管理和远程公开访问。
- 修改、删除、人工复核、配置编辑、任务控制或其他写入操作。
- 视频片段播放、RTSP 播放、长期录像回放和 WVP/NVR 控制。
- 在事件直接登记、没有 PTS 窗口的事件帧上叠加同一事件的检测框；自动取证生成的上下文图片保留原图，不叠加检测框，因为它们没有逐帧检测关联。
- 独立的浏览器构建链、前端框架或实时推送通道。
- PDF 报告导出、数据维护和事件重放。

## 页面结构

1. **运行概览**：顶部显示 SSV 标识和服务状态，主要区域显示统计卡片及最近事件。
2. **事件列表**：提供关键词、状态、结论和时间过滤；列表以事件发生时间倒序排列，显示来源、类型、状态、结论和证据状态。
3. **事件详情**：采用已讨论的参考图布局：深蓝侧栏、白色顶部栏和浅色内容区；顶部为事件来源、时间及 ID，主体左侧为大尺寸图片预览和多个事件图片切换，右侧为最新结论、置信度、证据状态与事件说明，底部为原始事件、检测记录和分析历史三张卡片。复核结论标明 `revision`，历史记录逐条显示 revision、时间、结论和说明；检测以事件记录为准；证据用 `evidence_id` 加载。上一条/下一条按当前筛选列表页的顺序切换，无相邻项时禁用。

图片按原始宽高比显示。仅当证据是事件直接登记的点事件图片（`source_pts_start`、`source_pts_end` 都缺失）时，使用事件记录的归一化 `[x1,y1,x2,y2]` bbox 绘制类别、置信度和可用的 `track_id`；带 PTS 窗口的上下文图片不叠加框。检测列表始终展示账本原始字段。未记录的检测模型、耗时和人工复核状态不编造。顶部状态只表明账本连接可用性。

时间字段缺失或不可用时显示“未知”，不使用浏览器当前时间代填。对于没有复核记录的事件，显示“尚无复核结论”；证据不可用时显示其状态，不暗示视频内容。

## HTTP 接口

所有接口均为同源只读 GET 请求，响应使用 UTF-8 JSON；错误响应不包含 SQL、宿主机路径或异常堆栈。

### `GET /api/health`

检查 Web 进程与只读账本连接是否可用，返回 `{ "status": "ok" }`。数据库不可读时返回 HTTP 503。

### `GET /api/overview`

返回概览统计：`total_events`、`pending_events`、`completed_events`、`needs_attention_events` 和 `newest_timestamp_ms`。没有可用时间时 `newest_timestamp_ms` 为 `null`。

### `GET /api/events`

可选查询参数：

| 参数 | 含义 |
| --- | --- |
| `q` | 匹配事件 ID、来源、事件类型或规则 ID 的关键词 |
| `source` | 来源精确匹配 |
| `status` | 状态精确匹配 |
| `verdict` | 复核结论精确匹配 |
| `from_ms` / `to_ms` | 毫秒时间范围，包含边界 |
| `limit` / `offset` | 分页；默认 `20` / `0`，`limit` 最大为 `100` |

返回 `{ "items": [...], "total": n, "limit": n, "offset": n }`。列表项只含展示需要的事件字段、检测数和可用证据数，不返回路径字段。

### `GET /api/events/{event_id}`

返回 `{ "event": {...}, "detections": [...], "evidence": [...], "latest_review": {...} | null, "review_history": [...] }`。`latest_review` 来自当前 review result 投影；`review_history` 只含账本实际保存的复核记录并按 revision 升序。缺少历史记录时不得把当前投影伪装成历史复核。复核字段包括结论、置信度、说明、claims、证据引用和创建时间。证据只返回 ID、类型、MIME、可用状态、大小和媒体时间信息；只有可展示的图片附同源媒体 URL。图片的 `detection_overlay` 表明其是否为可与事件检测关联的点事件帧；带 PTS 窗口的上下文图片为 `false`。视频记录保留原账本可用状态但 `media_url=null`，以便解释历史复核引用；不返回本机路径。

不存在的事件返回 HTTP 404。

### `GET /api/events/{event_id}/evidence/{evidence_id}`

只允许读取 SQLite 中与该事件关联、状态可用且类型为 `frame` 的登记图片。`clip`、越界路径、未登记 ID 或不可用文件均返回 HTTP 404。服务端在读取时重新验证文件存在、解析路径位于 `agent.evidence_roots` 范围内，并校验响应 MIME 类型。文件逐层打开并固定文件句柄，避免验证后按路径二次打开。不接受客户端路径参数。

## 数据与安全约束

- 每次查询使用 SQLite URI `mode=ro`，并设置 `PRAGMA query_only = ON`；详情及分页的复合查询在单个只读事务快照中完成。Web 初始化不创建数据库、不迁移 schema、不写 WAL 或业务数据。
- 事件列表、详情和复核历史只读 `EventLedger` 已持久化数据；不从 Redis 推断尚未入账事件。
- SQL 参数必须绑定，分页和时间范围在 HTTP 边界验证。
- API 使用显式字段投影，排除 `path`、`result_path` 和其他本机文件信息。
- 媒体只能从事件登记的 `evidence_id` 访问；解析后的文件路径须落在 `agent.evidence_roots` 内。空证据根列表时媒体读取 fail closed。
- 媒体响应持有已经验证的文件句柄并负责关闭；路径组件以 `openat`/`O_NOFOLLOW` 方式打开，避免路径替换绕过证据根校验。
- 默认监听 `127.0.0.1`。首版不提供登录认证，不应通过公网或不可信网络直接暴露服务。
- 查询失败返回稳定错误结构和 HTTP 状态码；错误细节写入服务日志，不向浏览器返回堆栈。

## 技术选择

- 后端：Python Agent 包内的 Starlette ASGI 应用，由 Uvicorn 提供服务；复用现有 `load_config`，不启动 Agent worker、Redis consumer 或写入型 `EventLedger`。
- 前端：随 Agent 包分发的原生 HTML、CSS 和 JavaScript；通过同源 API 获取 JSON，使用 10 秒轮询刷新概览和事件列表。
- 持久数据：现有 SQLite schema，不新增业务表或迁移。

## 验收方式

- 只读 API 测试覆盖概览、关键词/来源/状态/结论/时间过滤、分页、当前结论与真实历史的区分、缺失事件、证据登记验证及数据库写入拒绝。
- 页面校验使用真实 `ReviewResult` 结论枚举 `compliant`、`violation`、`uncertain`，通过 `ReviewClaim.text` 和 `ReviewClaim.evidence_ids` 呈现证据关联，并验证点事件图片叠框、上下文图片不叠框。
- 路径测试覆盖证据 ID 不匹配、文件不存在、根外路径和越界 symlink。
- Web CLI 可从 `./ssv web --config PATH` 启动，默认监听回环地址，并可用 `--host`、`--port` 显式覆盖。
- 前端资源由同一服务提供；空数据、加载中、服务错误、未知时间和缺失证据状态均有清晰展示。
- 运行 Agent Python 测试、CLI 定向测试、格式检查和 `git diff --check`。
