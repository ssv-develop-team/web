# Web 只读展示 MVP 实施计划

**规格**：`docs/specs/2026-10-08-Web只读展示MVP-spec.md`

**目标**：在 Agent 账本之上提供同源只读 HTTP API 和轻量 Web 页面，并从 `./ssv web` 启动。

**架构**：Starlette/Uvicorn 负责 HTTP；Agent 包内的只读查询服务每次通过 `mode=ro` 连接 SQLite；原生 HTML/CSS/JS 通过同一服务交付。媒体只按 `(event_id, evidence_id)` 从配置允许的证据根内读取。

## 步骤 1：增加只读查询服务与 API

涉及文件：

- `agent/src/ssv_agent/web/__init__.py`：新增 Web 包入口。
- `agent/src/ssv_agent/web/store.py`：新增 `ReadOnlyEventStore`，负责只读连接、`query_events()`、`get_overview()`、`get_event_detail()`、`resolve_evidence()` 和 `open_evidence()`。
- `agent/src/ssv_agent/web/app.py`：新增 `create_app()`、Starlette 路由 `health()`、`overview()`、`list_events()`、`event_detail()`、`event_evidence()`、`_byte_range()` 和 `_EvidenceResponse`；SQLite 查询及文件打开通过 `run_in_threadpool()` 执行。
- `agent/tests/test_web.py`：新增 SQLite/API 契约、安全路径和只读行为测试。
- `agent/pyproject.toml`、`agent/uv.lock`：增加 Starlette/Uvicorn 运行依赖与 HTTP 测试依赖。

验证：使用临时账本确认 GET 查询返回统计、筛选事件、最新结论与真实复核历史、登记证据；确认未登记或根外媒体不能读取、Range/HEAD 响应有效、已打开文件路径替换不影响当前响应，HTTP 请求不能写入账本。

## 步骤 2：接入本地启动命令

涉及文件：

- `agent/src/ssv_agent/web/cli.py`：新增 `main()`，解析 `--config`、`--host` 和 `--port`，加载 Agent 配置并运行 Uvicorn。
- `scripts/ssv_cli/commands/web.py`：新增 `run()`，准备 Agent 虚拟环境并启动 Web CLI。
- `scripts/ssv_cli/cli.py`：注册 `web` 子命令与参数。
- `scripts/ssv_cli/tests/test_cli.py`：覆盖 `./ssv web` 参数注册、默认监听地址和命令转发。

验证：检查 `./ssv --help` 和 `./ssv web --help`；使用临时配置及临时 SQLite 文件完成启动/健康检查。

## 步骤 3：实现页面和媒体呈现

涉及文件：

- `agent/src/ssv_agent/web/app.py`：挂载包内静态资源并将 `/` 指向页面入口。
- `agent/src/ssv_agent/web/static/index.html`：新增页面结构。
- `agent/src/ssv_agent/web/static/app.js`：新增同源 API 客户端、关键词/来源/状态/结论/时间筛选、分页、hash 导航、定时刷新和详情渲染。
- `agent/src/ssv_agent/web/static/styles.css`：新增响应式样式、状态色、证据缩略图和详情布局。

涉及前端标识符：`loadOverview()`、`loadEvents()`、`filters()`、`renderOverview()`、`renderEvents()`、`renderDetail()`、`openDetail()`、`routeFromHash()`、`navigateToView()`。claim 和结论证据引用使用 `evidence_ids` 切换至对应媒体主预览。

验证：确认静态资源可经本地服务读取，概览、列表、详情可通过 hash 导航及浏览器前进/后退，claim 的 `evidence_ids` 可切换到对应主预览，图片和 clip URL 只含事件/证据 ID，时间缺失显示“未知”。

## 步骤 4：补齐使用文档并完成验收

涉及文件：

- `docs/Agent配置.md`：新增 Web 启动、监听地址、API 和只读行为说明。
- `docs/Agent架构与实现.md`：补充 Web 只读模块的所有权边界和本地验证状态。
- `docs/README.md`：增加 Web MVP 使用文档入口。
- `README.md`：更新当前产品能力表述和最短 Web 启动命令。
- `docs/roadmap.md`：记录 Web 只读展示的实际阶段状态。

验证命令：

```bash
cd agent && uv run --extra dev pytest -q
cd .. && uv run --extra dev pytest -q scripts/ssv_cli/tests/test_cli.py
uv run ruff check agent/src/ssv_agent/web agent/tests/test_web.py scripts/ssv_cli/commands/web.py scripts/ssv_cli/cli.py
uv run ruff format --check agent/src/ssv_agent/web agent/tests/test_web.py scripts/ssv_cli/commands/web.py scripts/ssv_cli/cli.py
node --check agent/src/ssv_agent/web/static/app.js
git diff --check
```

最终用 `./ssv web --config config/ssv.yaml` 做本机启动和 `curl http://127.0.0.1:8765/api/health` 检查。验证结束后所有 Web 代码保持未提交状态，PR #31 保持开放。

## 2026-10-08 本地验收记录

- API/只读账本测试通过，覆盖真实 claim 契约、最新投影与历史区分、Range/HEAD、路径校验及 WAL 并发提交时的分页快照一致性。
- CLI 参数和转发测试通过；临时配置经 `./ssv web` 启动，同源静态资源与 `/api/health` 可访问，正常退出可关闭服务。
- 浏览器验证通过：概览/列表/详情导航、来源过滤、浏览器返回、claim 跳转证据卡片；合成 JPEG 与 H.264 MP4 可被解码。桌面和移动尺寸均已检查。真实摄像头、模型服务与业务数据端到端尚未验证。
- 全量 Agent 测试仍有 12 项失败；这 12 项已在不含 Web 改动的 `HEAD` 隔离源码中逐项复现，主要是移除 `recording_evidence.enabled` 后的旧 fixture，以及 consumer factory 参数约定不一致。
- `develop -> main` 的 PR #31 已创建但 CI 未通过：`test_ssv_pipeline_plan.cpp` 的 `assert` 宏遇到含逗号表达式导致 GCC 编译失败。此 PR 尚未合并，Web 本地修改未进入该 PR。

## 兼容性与回滚

- 不改变既有 SQLite schema、Agent worker、Redis 消费或事件写入行为。
- Web API 仅对外新增 GET 路由；缺少 Web 依赖时，既有 runner 和 Agent 命令路径不变。
- 若 Web 验收不通过，可移除 `ssv web` 命令、Agent Web 包和新增依赖；账本及其历史数据无需回滚。

## 2026-10-08 参考图版式修订

- 修改 `agent/src/ssv_agent/web/static/index.html` 的品牌、顶部状态栏与详情导航；修改 `agent/src/ssv_agent/web/static/styles.css` 为深蓝侧栏、浅色内容区、媒体/分析双栏及底部三卡布局。
- 修改 `agent/src/ssv_agent/web/static/app.js` 中的 `setView()`、`renderDetail()`、`renderEvidenceReference()`，增加 `renderMediaPreview()`、`renderActiveMedia()`、`selectEvidence()`、`renderReviewHistory()`、`formatBBox()` 与相邻事件切换。视频默认显示在主预览，事件帧作为封面；引用证据直接切换主预览；数据未变化时保留播放器，分析内容更新时恢复同一片段的播放位置。历史记录和原始事件字段可展开，离开详情时停止隐藏视频。
- 复用既有 HTTP/API 和只读账本，保持本地改动未提交；验证参考图布局、可用片段播放、事件帧/视频切换、缺失证据、轮询和移动尺寸，并执行现有定向检查。

本次修订验证：

- 浏览器检查 1024 × 728 与 390 × 844：浅色内容区、媒体/结论双栏与底部三卡布局可见，窄屏切为单列且无横向溢出。
- H.264 MP4 可解码并播放，事件帧和视频切换、claim 引用定位、真实历史展开、来源过滤、列表/概览入口与浏览器返回可用；无证据事件显示暂无证据及尚无结论。
- 内容未变时手动刷新保留同一 video 元素；模拟分析说明更新后，同一视频恢复 1.25 秒播放位置及暂停状态。
- Web 测试 14 项、CLI 测试 48 项及 5 个 subtests 通过；JavaScript 语法和 diff 空白检查通过。
- 本地预览使用临时账本与从参考图裁剪的图像；3 秒 MP4 是重复该帧生成的静态演示片段。它用于验证布局和播放器，不是摄像头真实录像；项目配置、业务账本和后端 API 未修改。

## 2026-10-09 图片证据范围修订

- Web 详情和媒体路由只开放 `frame` 图片；`clip` 不进入图片选择控件或常规证据标签，媒体路由拒绝读取视频。历史复核若引用视频 ID，则保留禁用的引用说明。事件列表中的证据数量只统计可展示图片。
- 事件直接登记且没有 PTS 窗口的图片允许叠加该事件的检测框；自动生成的带 PTS 窗口上下文图片只显示原图，检测记录继续以列表展示。
- 验收覆盖图片展示、点事件图片叠框、上下文图片不叠框、视频 evidence ID 在 Web API 中返回 404、图片路径安全和只读约束。
