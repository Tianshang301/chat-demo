import { create } from 'zustand'
import { normalizeLocation, type UserLocation } from './location.js'
import { isDeepSeekApi, normalizeBaseUrl, type ApiProtocol } from './providers.js'
import { estimateContextWindow } from './context.js'

export type Locale = 'zh-CN' | 'en-US'
export type ThemePreference = 'light' | 'dark' | 'system'

export type SearchProvider = 'deepseek' | 'custom'
export type TtsProvider = 'deepseek' | 'xiaomi' | 'minimax' | 'openai'
export type AsrProvider = 'deepseek' | 'xiaomi' | 'minimax' | 'openai'

export const DEEPSEEK_BASE_URL = `${__API_ORIGIN__}/anthropic/v1`
export const DEEPSEEK_TOOLS_BASE_URL = `${__API_ORIGIN__}/v1/tools`
export const XIAOMI_BASE_URL = 'https://api.xiaomimimo.com/v1'
export const MINIMAX_BASE_URL = 'https://api.minimax.io/v1'

type Settings = {
  apiKey: string | null
  deepseekApiKey: string | null
  apiProtocol: ApiProtocol
  baseUrl: string
  corsProxy: string
  deepseekCompatible: boolean
  model: string
  contextWindow: number | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  thinking: boolean
  search: boolean
  siderCollapsed: boolean

  searchProvider: SearchProvider
  searchBaseUrl: string
  searchApiKey: string | null
  searchModel: string

  ttsProvider: TtsProvider
  ttsBaseUrl: string
  ttsApiKey: string | null
  ttsModel: string
  ttsVoice: string

  asrProvider: AsrProvider
  asrBaseUrl: string
  asrApiKey: string | null
  asrModel: string
  asrLanguage: string
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  deepseekApiKey: 'chat-demo:deepseek-api-key',
  apiProtocol: 'chat-demo:api-protocol',
  baseUrl: 'chat-demo:base-url',
  corsProxy: 'chat-demo:cors-proxy',
  deepseekCompatible: 'chat-demo:deepseek-compatible',
  model: 'chat-demo:model',
  contextWindow: 'chat-demo:context-window',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
  searchProvider: 'chat-demo:search-provider',
  searchBaseUrl: 'chat-demo:search-base-url',
  searchApiKey: 'chat-demo:search-api-key',
  searchModel: 'chat-demo:search-model',
  ttsProvider: 'chat-demo:tts-provider',
  ttsBaseUrl: 'chat-demo:tts-base-url',
  ttsApiKey: 'chat-demo:tts-api-key',
  ttsModel: 'chat-demo:tts-model',
  ttsVoice: 'chat-demo:tts-voice',
  asrProvider: 'chat-demo:asr-provider',
  asrBaseUrl: 'chat-demo:asr-base-url',
  asrApiKey: 'chat-demo:asr-api-key',
  asrModel: 'chat-demo:asr-model',
  asrLanguage: 'chat-demo:asr-language',
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
    // ignore storage errors
  }
}

const clean = (value: string | null | undefined) => value?.trim() || null
const cleanUrl = (value: string | null | undefined, fallback = '') =>
  value ? normalizeBaseUrl(value) : fallback

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

const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

const initialProtocol = (): ApiProtocol =>
  read(KEYS.apiProtocol) === 'openai' ? 'openai' : 'anthropic'

const initialBaseUrl = (): string => {
  const saved = read(KEYS.baseUrl)
  return normalizeBaseUrl(saved || DEEPSEEK_BASE_URL)
}

const initialCorsProxy = (): string => read(KEYS.corsProxy)?.trim() ?? ''
const initialDeepseekCompatible = (): boolean => read(KEYS.deepseekCompatible) === 'true'
const initialModel = (): string => read(KEYS.model)?.trim() || 'deepseek-flash'

const initialContextWindow = (): number | null => {
  const saved = Number(read(KEYS.contextWindow))
  if (Number.isFinite(saved) && saved > 0) {
    return Math.floor(saved)
  }
  return estimateContextWindow(initialModel())
}

const migrateTtsVoice = (provider: TtsProvider): string => {
  const saved = read(KEYS.ttsVoice)?.trim()
  if (saved) {
    if (provider === 'deepseek') {
      return saved === 'tide' ? 'tide' : 'stella'
    }
    if (provider === 'xiaomi') {
      if (saved === 'tide') {
        return 'Milo'
      }
      if (saved === 'stella') {
        return 'Mia'
      }
      return saved
    }
    return saved
  }
  if (provider === 'deepseek') {
    return 'stella'
  }
  if (provider === 'xiaomi') {
    return 'mimo_default'
  }
  if (provider === 'openai') {
    return 'alloy'
  }
  return 'male-qn-qingse'
}

const initialTtsProvider = (): TtsProvider => {
  const saved = read(KEYS.ttsProvider)
  if (saved === 'xiaomi' || saved === 'minimax' || saved === 'openai') {
    return saved
  }
  return 'deepseek'
}

const initialAsrProvider = (): AsrProvider => {
  const saved = read(KEYS.asrProvider)
  if (saved === 'xiaomi' || saved === 'minimax' || saved === 'openai') {
    return saved
  }
  return 'deepseek'
}

const initialSearchProvider = (): SearchProvider =>
  read(KEYS.searchProvider) === 'custom' ? 'custom' : 'deepseek'

const ttsProvider = initialTtsProvider()
const asrProvider = initialAsrProvider()

export const supportsDeepSeekTools = (
  settings: Pick<Settings, 'baseUrl' | 'deepseekCompatible' | 'apiProtocol'>
): boolean =>
  isDeepSeekApi(settings.baseUrl) ||
  (settings.apiProtocol === 'anthropic' && settings.deepseekCompatible)

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  deepseekApiKey: read(KEYS.deepseekApiKey),
  apiProtocol: initialProtocol(),
  baseUrl: initialBaseUrl(),
  corsProxy: initialCorsProxy(),
  deepseekCompatible: initialDeepseekCompatible(),
  model: initialModel(),
  contextWindow: initialContextWindow(),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',

  searchProvider: initialSearchProvider(),
  searchBaseUrl: cleanUrl(read(KEYS.searchBaseUrl), ''),
  searchApiKey: clean(read(KEYS.searchApiKey)),
  searchModel: read(KEYS.searchModel)?.trim() || 'deepseek-flash',

  ttsProvider,
  ttsBaseUrl: cleanUrl(
    read(KEYS.ttsBaseUrl),
    ttsProvider === 'xiaomi'
      ? XIAOMI_BASE_URL
      : ttsProvider === 'minimax'
        ? MINIMAX_BASE_URL
        : ttsProvider === 'openai'
          ? 'https://api.openai.com/v1'
          : DEEPSEEK_TOOLS_BASE_URL
  ),
  ttsApiKey: clean(read(KEYS.ttsApiKey)),
  ttsModel: read(KEYS.ttsModel)?.trim() || '',
  ttsVoice: migrateTtsVoice(ttsProvider),

  asrProvider,
  asrBaseUrl: cleanUrl(
    read(KEYS.asrBaseUrl),
    asrProvider === 'xiaomi'
      ? XIAOMI_BASE_URL
      : asrProvider === 'minimax'
        ? MINIMAX_BASE_URL
        : asrProvider === 'openai'
          ? 'https://api.openai.com/v1'
          : DEEPSEEK_TOOLS_BASE_URL
  ),
  asrApiKey: clean(read(KEYS.asrApiKey)),
  asrModel: read(KEYS.asrModel)?.trim() || '',
  asrLanguage: read(KEYS.asrLanguage)?.trim() || 'auto',
}))

export const useSupportsDeepSeekTools = () =>
  useSettings(
    (state) =>
      isDeepSeekApi(state.baseUrl) ||
      (state.apiProtocol === 'anthropic' && state.deepseekCompatible)
  )

export const getDeepseekFallbackKey = (state: Settings): string | null =>
  state.deepseekApiKey ?? (supportsDeepSeekTools(state) ? state.apiKey : null)

export const getSearchConfig = () => {
  const state = useSettings.getState()
  if (state.searchProvider === 'custom') {
    return {
      provider: 'custom' as const,
      baseUrl: state.searchBaseUrl,
      apiKey: state.searchApiKey ?? '',
      model: state.searchModel,
    }
  }
  return {
    provider: 'deepseek' as const,
    baseUrl: state.searchBaseUrl || `${__API_ORIGIN__}/anthropic/v1`,
    apiKey: state.searchApiKey ?? getDeepseekFallbackKey(state) ?? '',
    model: state.searchModel || 'deepseek-flash',
  }
}

export const canUseSearch = (state: Settings = useSettings.getState()) => {
  if (state.searchProvider === 'custom') {
    return !!state.searchBaseUrl
  }
  return !!(state.searchApiKey ?? getDeepseekFallbackKey(state))
}

export const useCanUseSearch = () => useSettings(canUseSearch)

export const getTtsConfig = () => {
  const state = useSettings.getState()
  const fallback = state.ttsProvider === 'deepseek' ? getDeepseekFallbackKey(state) : null
  const defaults =
    state.ttsProvider === 'deepseek'
      ? { baseUrl: DEEPSEEK_TOOLS_BASE_URL, model: 'deepseek-tts', voice: 'stella' }
      : state.ttsProvider === 'xiaomi'
        ? { baseUrl: XIAOMI_BASE_URL, model: 'mimo-v2.5-tts', voice: 'mimo_default' }
        : state.ttsProvider === 'minimax'
          ? { baseUrl: MINIMAX_BASE_URL, model: 'speech-2.8-hd', voice: 'male-qn-qingse' }
          : { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts', voice: 'alloy' }
  return {
    provider: state.ttsProvider,
    baseUrl: state.ttsBaseUrl || defaults.baseUrl,
    apiKey: state.ttsApiKey ?? fallback ?? '',
    model: state.ttsModel || defaults.model,
    voice: state.ttsVoice || defaults.voice,
  }
}

export const canUseTts = (state: Settings = useSettings.getState()) =>
  !!(state.ttsApiKey ?? (state.ttsProvider === 'deepseek' ? getDeepseekFallbackKey(state) : null))

export const useCanUseTts = () => useSettings(canUseTts)

export const getAsrConfig = () => {
  const state = useSettings.getState()
  const fallback = state.asrProvider === 'deepseek' ? getDeepseekFallbackKey(state) : null
  const defaults =
    state.asrProvider === 'deepseek'
      ? { baseUrl: DEEPSEEK_TOOLS_BASE_URL, model: 'deepseek-asr' }
      : state.asrProvider === 'xiaomi'
        ? { baseUrl: XIAOMI_BASE_URL, model: 'mimo-v2.5-asr' }
        : state.asrProvider === 'minimax'
          ? { baseUrl: MINIMAX_BASE_URL, model: 'asr-1.0' }
          : { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini-transcribe' }
  return {
    provider: state.asrProvider,
    baseUrl: state.asrBaseUrl || defaults.baseUrl,
    apiKey: state.asrApiKey ?? fallback ?? '',
    model: state.asrModel || defaults.model,
    language: state.asrLanguage || 'auto',
  }
}

export const canUseAsr = (state: Settings = useSettings.getState()) =>
  !!(state.asrApiKey ?? (state.asrProvider === 'deepseek' ? getDeepseekFallbackKey(state) : null))

export const useCanUseAsr = () => useSettings(canUseAsr)

export const setApiProtocol = (apiProtocol: ApiProtocol) => {
  write(KEYS.apiProtocol, apiProtocol)
  useSettings.setState({ apiProtocol })
}

export const setBaseUrl = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl)
  write(KEYS.baseUrl, normalized)
  useSettings.setState({ baseUrl: normalized })
}

export const setCorsProxy = (corsProxy: string) => {
  let value = corsProxy.trim()
  if (value && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`
  }
  write(KEYS.corsProxy, value || null)
  useSettings.setState({ corsProxy: value })
}

export const setDeepseekCompatible = (deepseekCompatible: boolean) => {
  write(KEYS.deepseekCompatible, String(deepseekCompatible))
  useSettings.setState({ deepseekCompatible })
}

export const setModel = (model: string, contextWindow?: number | null) => {
  const window = contextWindow ?? estimateContextWindow(model)
  write(KEYS.model, model)
  write(KEYS.contextWindow, window === null ? null : String(window))
  useSettings.setState({ model, contextWindow: window })
}

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

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setDeepseekApiKey = (deepseekApiKey: string | null) => {
  const value = deepseekApiKey?.trim() || null
  write(KEYS.deepseekApiKey, value)
  useSettings.setState({ deepseekApiKey: value })
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

export const setSearchProvider = (provider: SearchProvider) => {
  write(KEYS.searchProvider, provider)
  useSettings.setState({ searchProvider: provider })
}
export const setSearchBaseUrl = (value: string) => {
  const v = normalizeBaseUrl(value)
  write(KEYS.searchBaseUrl, v || null)
  useSettings.setState({ searchBaseUrl: v })
}
export const setSearchApiKey = (value: string | null) => {
  const v = clean(value)
  write(KEYS.searchApiKey, v)
  useSettings.setState({ searchApiKey: v })
}
export const setSearchModel = (value: string) => {
  const v = value.trim() || 'deepseek-flash'
  write(KEYS.searchModel, v)
  useSettings.setState({ searchModel: v })
}

const defaultTts = (provider: TtsProvider) =>
  provider === 'deepseek'
    ? { baseUrl: DEEPSEEK_TOOLS_BASE_URL, model: 'deepseek-tts', voice: 'stella' }
    : provider === 'xiaomi'
      ? { baseUrl: XIAOMI_BASE_URL, model: 'mimo-v2.5-tts', voice: 'mimo_default' }
      : provider === 'minimax'
        ? { baseUrl: MINIMAX_BASE_URL, model: 'speech-2.8-hd', voice: 'male-qn-qingse' }
        : { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts', voice: 'alloy' }

export const setTtsProvider = (provider: TtsProvider) => {
  const d = defaultTts(provider)
  write(KEYS.ttsProvider, provider)
  write(KEYS.ttsBaseUrl, d.baseUrl)
  write(KEYS.ttsModel, d.model)
  write(KEYS.ttsVoice, d.voice)
  useSettings.setState({ ttsProvider: provider, ttsBaseUrl: d.baseUrl, ttsModel: d.model, ttsVoice: d.voice })
}
export const setTtsBaseUrl = (value: string) => {
  const v = normalizeBaseUrl(value)
  write(KEYS.ttsBaseUrl, v || null)
  useSettings.setState({ ttsBaseUrl: v })
}
export const setTtsApiKey = (value: string | null) => {
  const v = clean(value)
  write(KEYS.ttsApiKey, v)
  useSettings.setState({ ttsApiKey: v })
}
export const setTtsModel = (value: string) => {
  const v = value.trim()
  write(KEYS.ttsModel, v || null)
  useSettings.setState({ ttsModel: v })
}
export const setTtsVoice = (value: string) => {
  const v = value.trim()
  write(KEYS.ttsVoice, v || null)
  useSettings.setState({ ttsVoice: v })
}

const defaultAsr = (provider: AsrProvider) =>
  provider === 'deepseek'
    ? { baseUrl: DEEPSEEK_TOOLS_BASE_URL, model: 'deepseek-asr' }
    : provider === 'xiaomi'
      ? { baseUrl: XIAOMI_BASE_URL, model: 'mimo-v2.5-asr' }
      : provider === 'minimax'
        ? { baseUrl: MINIMAX_BASE_URL, model: 'asr-1.0' }
        : { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini-transcribe' }

export const setAsrProvider = (provider: AsrProvider) => {
  const d = defaultAsr(provider)
  write(KEYS.asrProvider, provider)
  write(KEYS.asrBaseUrl, d.baseUrl)
  write(KEYS.asrModel, d.model)
  useSettings.setState({ asrProvider: provider, asrBaseUrl: d.baseUrl, asrModel: d.model })
}
export const setAsrBaseUrl = (value: string) => {
  const v = normalizeBaseUrl(value)
  write(KEYS.asrBaseUrl, v || null)
  useSettings.setState({ asrBaseUrl: v })
}
export const setAsrApiKey = (value: string | null) => {
  const v = clean(value)
  write(KEYS.asrApiKey, v)
  useSettings.setState({ asrApiKey: v })
}
export const setAsrModel = (value: string) => {
  const v = value.trim()
  write(KEYS.asrModel, v || null)
  useSettings.setState({ asrModel: v })
}
export const setAsrLanguage = (value: string) => {
  const v = value.trim() || 'auto'
  write(KEYS.asrLanguage, v)
  useSettings.setState({ asrLanguage: v })
}
