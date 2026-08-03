import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080'

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
        '/api': { target: proxyTarget, changeOrigin: true },
        '/rtp': { target: proxyTarget, changeOrigin: true, ws: true },
        '/mp4_record': { target: proxyTarget, changeOrigin: true, ws: true },
        '/mediaserver': { target: proxyTarget, changeOrigin: true },
      },
    },
  }
})
