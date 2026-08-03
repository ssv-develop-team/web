import type Jessibuca from './jessibuca.d'

declare global {
  interface Window {
    Jessibuca: typeof Jessibuca
  }
}

export interface JessibucaPlayerOptions {
  container: HTMLElement
  /** 通道是否含音频(DeviceChannel.hasAudio) */
  hasAudio?: boolean
  debug?: boolean
}

/**
 * 创建 Jessibuca 播放器。
 * 资源在 public/player/(jessibuca.js 由 index.html 以 script 引入,
 * decoder.wasm 由 decoder.js 按需加载),配置与官方前端一致(04 §4.4)。
 */
export function createJessibucaPlayer(opts: JessibucaPlayerOptions) {
  return new window.Jessibuca({
    container: opts.container,
    decoder: '/player/decoder.js',
    videoBuffer: 0,
    isResize: true,
    useMSE: false,
    useWCS: false,
    hasAudio: opts.hasAudio ?? true,
    debug: opts.debug ?? false,
    timeout: 10,
    heartTimeout: 5,
    heartTimeoutReplay: true,
    heartTimeoutReplayTimes: 3,
    loadingTimeout: 10,
    loadingTimeoutReplay: true,
    loadingTimeoutReplayTimes: 3,
    forceNoOffscreen: true,
    keepScreenOn: true,
    wasmDecodeErrorReplay: true,
    controlAutoHide: false,
    operateBtns: {
      fullscreen: false,
      screenshot: false,
      play: false,
      audio: false,
      record: false,
    },
  })
}
