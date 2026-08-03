/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基地址;留空表示同源(开发期走 Vite proxy,见 05 §8) */
  readonly VITE_WVP_BASE_URL?: string
  /** Vite dev proxy 目标:nginx 外部地址 */
  readonly VITE_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
