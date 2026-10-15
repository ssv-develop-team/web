import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080'
  const ssvProxyTarget = env.VITE_SSV_API_PROXY_TARGET || 'http://127.0.0.1:8765'

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // 05 §8: 开发期走 nginx 外部地址,复用 /api/ 的 sub_filter 媒体地址重写
        // 注意带斜杠: '/api' 前缀会误伤 /api-keys 等前端路由
        '/api/': { target: proxyTarget, changeOrigin: true },
        '/rtp': { target: proxyTarget, changeOrigin: true, ws: true },
        // 实时日志 WebSocket(04 §4.9): 令牌作为子协议
        '/channel/log': { target: proxyTarget, changeOrigin: true, ws: true },
        '/mp4_record': { target: proxyTarget, changeOrigin: true, ws: true },
        '/mediaserver': { target: proxyTarget, changeOrigin: true },
        // 独立 SSV 路径：/ssv-api/api/v1 -> Agent 的 /api/v1。
        '/ssv-api': {
          target: ssvProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ssv-api/, ''),
        },
      },
    },
  }
})
