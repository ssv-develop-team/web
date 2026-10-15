# wvp-web-ui

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### SSV 事件页

事件列表和详情页使用独立的 SSV 只读 API 适配层，请求前缀为 `/ssv-api/api/v1`，不会经过 WVP 登录令牌客户端。开发服务器默认把 `/ssv-api` 转发到 `http://127.0.0.1:8765`，也可以通过 `VITE_SSV_API_PROXY_TARGET` 覆盖：

```sh
VITE_SSV_API_PROXY_TARGET=http://127.0.0.1:8765 npm run dev
```

生产部署需要在同源入口另行配置 `/ssv-api/` 反向代理，将前缀去掉后转发到已启动的 SSV Agent Web API，例如 `location /ssv-api/ { proxy_pass http://<可访问的 Agent 地址>:8765/; }`。末尾的 `/` 会把 `/ssv-api/` 映射为 Agent 的 `/`，使浏览器请求 `/ssv-api/api/v1/...` 到达 Agent 的 `/api/v1/...`。

已核对 `wvp-baseline/skeletons/nginx/templates/nginx.conf.template`：模板目前只代理 WVP 的 `/api/`，没有 SSV location；其 Compose 中的 `polaris-nginx` 和 `polaris-wvp` 位于 `media-net`，尚未接入 Agent 服务。生产还需把 Nginx 与 Agent 放到可互通的网络并设置可访问的上游地址。Agent 默认监听 `127.0.0.1:8765`，跨容器时需配置可被 Nginx 访问的监听地址或部署网络；这些生产端配置尚未完成。未配置代理时，页面会显示可重试的 API 错误。

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
