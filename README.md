# wvp-web-ui

## 实现目的

当前分支是基于 Vue 3 和 Vite 的 WVP Web 管理与监控前端，提供以下页面能力：

- WVP 设备、通道、实时播放、录像回放、媒体服务器、流代理、推流、级联平台和录像计划管理。
- 用户、API 密钥、告警、设备位置和实时日志管理。
- 通过独立的只读 SSV API 展示事件列表、事件详情、检测结果、复核记录和证据图片。

WVP 请求使用 `/api/`，SSV 事件请求使用 `/ssv-api/`；两者通过 Vite 开发代理分别转发到对应服务。

## 运行方式

### 环境要求

- Node.js `22.18+` 或 `24.12+`
- npm
- 可访问的 WVP 服务，默认地址为 `http://127.0.0.1:8181`
- 可访问的 SSV Agent 只读 API，默认地址为 `http://127.0.0.1:8765`

### 安装依赖

```sh
npm install
```

### 启动开发服务

```sh
npm run dev
```

默认访问地址为 `http://localhost:5173`。如需修改后端地址，可在启动时覆盖环境变量：

```sh
VITE_PROXY_TARGET=http://127.0.0.1:8181 \\
VITE_SSV_API_PROXY_TARGET=http://127.0.0.1:8765 \\
npm run dev
```

### 构建生产文件

```sh
npm run build
```
