/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基地址;留空表示同源(开发期走 Vite proxy,见 05 §8) */
  readonly VITE_WVP_BASE_URL?: string
  /** Vite dev proxy 目标:nginx 外部地址 */
  readonly VITE_PROXY_TARGET?: string
  /** wvp-ai YOLO 服务基地址;默认 http://127.0.0.1:18000 */
  /** SSV Agent 只读 API 的开发代理目标；默认 http://127.0.0.1:8765 */
  readonly VITE_SSV_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
