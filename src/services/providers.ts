/** 接口协议：OpenAI Chat Completions 或 Anthropic Messages */
export type ApiProtocol = 'openai' | 'anthropic'

export type ProviderGroup = 'api' | 'coding'

export type ProviderPreset = {
  id: string
  /** 服务商与线路名称；品牌名不做翻译 */
  name: string
  group: ProviderGroup
  protocol: ApiProtocol
  /** 不带末尾斜杠的 API 根地址，请求时再拼 /models、/messages、/chat/completions */
  baseUrl: string
  model: string
}

/**
 * 常见服务商的 API 平台与 Coding Plan 预设。
 * Coding Plan 的 Key 与普通 API Key 通常不能混用，Base URL 也经常不同。
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI API',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6.2-sol',
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    group: 'api',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5-5',
  },
  {
    id: 'gemini',
    name: 'Google Gemini API',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-4-hydrogen',
  },
  {
    id: 'grok',
    name: 'xAI Grok API',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4.7',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-6.2-sol',
  },
  {
    id: 'sensenova',
    name: 'SenseNova Token Plan',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://token.sensenova.cn/v1',
    model: 'sensenova-6.8-flash-lite',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API (Anthropic)',
    group: 'api',
    protocol: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic/v1',
    model: 'deepseek-flash',
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen API (Intl)',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-coder-plus',
  },
  {
    id: 'kimi',
    name: 'Kimi API (Open Platform)',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-k2.5',
  },
  {
    id: 'zai',
    name: 'Z.ai GLM API',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'glm-5.3',
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi MiMo API',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.6-pro',
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    group: 'api',
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/zen/v1',
    model: 'glm-5.3',
  },
  {
    id: 'zai-coding-openai',
    name: 'Z.ai GLM Coding Plan (OpenAI)',
    group: 'coding',
    protocol: 'openai',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    model: 'glm-5.3',
  },
  {
    id: 'zai-coding-anthropic',
    name: 'Z.ai GLM Coding Plan (Anthropic)',
    group: 'coding',
    protocol: 'anthropic',
    baseUrl: 'https://api.z.ai/api/anthropic/v1',
    model: 'glm-5.3',
  },
  {
    id: 'kimi-coding-openai',
    name: 'Kimi Code (OpenAI)',
    group: 'coding',
    protocol: 'openai',
    baseUrl: 'https://api.kimi.com/coding/v1',
    model: 'kimi-for-coding',
  },
  {
    id: 'kimi-coding-anthropic',
    name: 'Kimi Code (Anthropic)',
    group: 'coding',
    protocol: 'anthropic',
    baseUrl: 'https://api.kimi.com/coding/v1',
    model: 'kimi-for-coding',
  },
  {
    id: 'qwen-coding-cn',
    name: 'Alibaba Coding Plan (CN)',
    group: 'coding',
    protocol: 'openai',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    model: 'qwen3-coder-plus',
  },
  {
    id: 'qwen-coding-intl',
    name: 'Alibaba Coding Plan (Intl)',
    group: 'coding',
    protocol: 'openai',
    baseUrl: 'https://coding-intl.dashscope.aliyuncs.com/v1',
    model: 'qwen3-coder-plus',
  },
  {
    id: 'xiaomi-plan-cn',
    name: 'Xiaomi MiMo Token Plan (CN)',
    group: 'coding',
    protocol: 'openai',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.6-pro',
  },
  {
    id: 'xiaomi-plan-cn-anthropic',
    name: 'Xiaomi MiMo Token Plan (Anthropic)',
    group: 'coding',
    protocol: 'anthropic',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic/v1',
    model: 'mimo-v2.6-pro',
  },
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    group: 'coding',
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/inference/go/openai/v1',
    model: 'glm-5.3',
  },
]

export const CUSTOM_PRESET_ID = 'custom'

export const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim()
  const stripped = trimmed.replace(/\/+$/, '')
  // 保留协议后的 //，避免输入 https:// 时中间态被截断导致无法继续键入
  if (/^[a-z][a-z0-9+.-]*:$/i.test(stripped)) {
    const suffix = trimmed.slice(stripped.length)
    if (/^\/{1,2}$/.test(suffix)) {
      return stripped + suffix
    }
  }
  return stripped
}

export const findPreset = (
  protocol: ApiProtocol,
  baseUrl: string,
  model: string
): ProviderPreset | undefined => {
  const normalized = normalizeBaseUrl(baseUrl)
  return PROVIDER_PRESETS.find(
    (preset) =>
      preset.protocol === protocol && preset.baseUrl === normalized && preset.model === model.trim()
  )
}

/** DeepSeek 兼容接口额外提供 Files、联网搜索、标题、语音等扩展能力 */
export const isDeepSeekApi = (baseUrl: string) =>
  normalizeBaseUrl(baseUrl).toLowerCase().includes('api.deepseek.com')

export const presetLabel = (preset: ProviderPreset) =>
  preset.group === 'coding' ? `Coding Plan · ${preset.name}` : `API · ${preset.name}`
