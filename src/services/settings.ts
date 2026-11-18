import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'
import { isDeepSeekApi, normalizeBaseUrl, type ApiProtocol } from './providers.js'
import { estimateContextWindow } from './context.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 本机设置，存 localStorage：接口配置、API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、侧边栏收起状态 */
type Settings = {
  apiKey: string | null
  apiProtocol: ApiProtocol
  baseUrl: string
  model: string
  /** 当前模型的上下文窗口；null 表示服务商未返回且本地没有已核对的数值 */
  contextWindow: number | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  apiProtocol: 'chat-demo:api-protocol',
  baseUrl: 'chat-demo:base-url',
  model: 'chat-demo:model',
  contextWindow: 'chat-demo:context-window',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

const initialProtocol = (): ApiProtocol =>
  read(KEYS.apiProtocol) === 'openai' ? 'openai' : 'anthropic'

/** 未保存过时沿用构建期的 DeepSeek Anthropic 兼容地址 */
const initialBaseUrl = (): string => {
  const saved = read(KEYS.baseUrl)
  return normalizeBaseUrl(saved || `${__API_ORIGIN__}/anthropic/v1`)
}

const initialModel = (): string => read(KEYS.model)?.trim() || 'deepseek-flash'

const initialContextWindow = (): number | null => {
  const saved = Number(read(KEYS.contextWindow))
  if (Number.isFinite(saved) && saved > 0) {
    return Math.floor(saved)
  }
  return estimateContextWindow(initialModel())
}

/** 当前接口是否支持 DeepSeek 的 Files、联网搜索、标题与语音扩展 */
export const supportsDeepSeekTools = (settings: Pick<Settings, 'baseUrl'>): boolean =>
  isDeepSeekApi(settings.baseUrl)

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  apiProtocol: initialProtocol(),
  baseUrl: initialBaseUrl(),
  model: initialModel(),
  contextWindow: initialContextWindow(),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
}))

export const useSupportsDeepSeekTools = () => useSettings((state) => isDeepSeekApi(state.baseUrl))

export const setApiProtocol = (apiProtocol: ApiProtocol) => {
  write(KEYS.apiProtocol, apiProtocol)
  useSettings.setState({ apiProtocol })
}

export const setBaseUrl = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl)
  write(KEYS.baseUrl, normalized)
  useSettings.setState({ baseUrl: normalized })
}

export const setModel = (model: string, contextWindow?: number | null) => {
  // 从 /models 选中模型时带上服务商返回的窗口；手动输入时改用已核对的值或未知
  const window = contextWindow ?? estimateContextWindow(model)
  write(KEYS.model, model)
  write(KEYS.contextWindow, window === null ? null : String(window))
  useSettings.setState({ model, contextWindow: window })
}

/** 应用服务商预设时一次性写入协议、Base URL、模型与上下文窗口，避免中间状态被保存 */
export const applyApiConfig = (config: {
  apiProtocol: ApiProtocol
  baseUrl: string
  model: string
  contextWindow?: number | null
}) => {
  const baseUrl = normalizeBaseUrl(config.baseUrl)
  const model = config.model.trim()
  const contextWindow = config.contextWindow ?? estimateContextWindow(model)
  write(KEYS.apiProtocol, config.apiProtocol)
  write(KEYS.baseUrl, baseUrl)
  write(KEYS.model, model)
  write(KEYS.contextWindow, contextWindow === null ? null : String(contextWindow))
  useSettings.setState({ apiProtocol: config.apiProtocol, baseUrl, model, contextWindow })
}

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
