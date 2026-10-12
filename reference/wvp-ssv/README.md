# `wvp-ssv` Web 源码参考快照

## 用途

此目录保存从 `wvp-ssv` 工作区迁入的旧 Web 原型源码，供后续重做前端时理解已有页面行为、事件字段和证据访问约束。它是阅读材料，不是 `wvp-ssv-web` 的实现目录，也不保证可以独立运行。

快照保留了迁移时的原路径。它没有包含 Agent 的完整配置、账本实现、GStreamer 运行时和部署环境；测试与依赖文件用于解释原型的调用关系，不构成此仓库的测试或构建配置。

## 阅读顺序

1. `scripts/ssv_cli/cli.py` 注册 `web` 命令，`scripts/ssv_cli/commands/web.py` 转入 Agent Python 包。
2. `agent/src/ssv_agent/web/cli.py` 读取 Agent 配置并创建应用。
3. `agent/src/ssv_agent/web/app.py` 定义健康检查、概览、事件列表、事件详情、图片证据和静态页面路由。
4. `agent/src/ssv_agent/web/store.py` 通过只读 SQLite 连接查询事件；图片按 `(event_id, evidence_id)` 查找，并限制在配置的证据目录内。
5. `agent/src/ssv_agent/web/static/` 是原页面的 HTML、CSS 与 JavaScript；`agent/tests/test_web.py` 覆盖查询、证据访问和只读约束。

`agent/pyproject.toml`、`scripts/ssv_cli/cli.py` 和 `scripts/ssv_cli/tests/test_cli.py` 包含周边集成上下文，因此会同时出现与 Web 无关的 Agent 依赖和 CLI 命令。

旧版需求与计划见 `docs/specs/2026-10-08-Web只读展示MVP-spec.md` 和 `docs/plans/2026-10-08-Web只读展示MVP-plan.md`。其中描述的是迁移前的设计，不能视为当前后端 API 或部署方式的承诺。

## 旧原型的行为线索

- 概览展示账本累计事件数、待处理数、已完成数、需关注数和最新事件时间。
- 列表按关键词、来源、状态、结论和时间范围筛选，并支持分页。
- 详情将事件、检测记录、最新结论、真实复核 revision 历史与登记证据分开读取；按稳定 ID 关联结论引用和图片。
- 页面只展示图片证据，不开放登记的视频片段。满足旧契约条件的直接事件帧可叠加检测框；上下文图片保持原图。
- 证据接口只返回已登记且位于允许目录内的文件，支持 Range/HEAD；数据库查询连接开启只读约束。

新实现应先确认现行后端 API 和播放会话契约，再决定如何沿用这些行为。不要因为快照里出现 `/api/...` 路由，就假定这些路由当前仍可访问。
