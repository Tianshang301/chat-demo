import { translate, type TranslationMessage } from '../../i18n/index.js'
import type { ApiProtocol } from '../providers.js'
import { readMessageEvent } from './parseEvent.js'
import { readServerSentEvents } from './sse.js'
import type {
  ApiErrorBody,
  CreateMessageRequest,
  FileObject,
  FilePurpose,
  MessageStreamEvent,
  MessageUsage,
} from './types.js'

/** 构建期 API 地址，默认 https://api.deepseek.com；本地开发支持开发服务器代理 */
export const API_ORIGIN = __API_ORIGIN__
/** 引用 Files API 上传的图片、调用 Anthropic 兼容 Files API 时必须携带 */
const FILES_BETA = 'files-api-2025-04-14'
/** Anthropic Messages 的必传版本头 */
const ANTHROPIC_VERSION = '2026-10-21'

export type ApiConnection = {
  protocol: ApiProtocol
  /** API 根地址，去掉末尾斜杠；请求时拼接 /models、/messages、/chat/completions */
  baseUrl: string
  /** 可选 CORS 代理；用于 GitHub Pages 等浏览器环境访问不支持跨域的服务商 */
  corsProxy?: string
}

export type ApiErrorKind =
  /** 非 2xx 响应 */
  | 'http'
  /** 流中返回的错误帧（如等待生成超时），随后连接关闭 */
  | 'stream'
  /** 请求没有到达服务端（断网、跨域被拦截等） */
  | 'network'
  /** 流在 message_stop 之前结束 */
  | 'interrupted'
  /** 响应不符合协议（如非 SSE 响应） */
  | 'protocol'

export class ApiError extends Error {
  readonly localMessage?: TranslationMessage

  constructor(
    readonly kind: ApiErrorKind,
    message: string | TranslationMessage,
    readonly status?: number
  ) {
    super(typeof message === 'string' ? message : translate(message.key, message.params))
    this.name = 'ApiError'
    this.localMessage = typeof message === 'string' ? undefined : message
  }
}

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  typeof (value as ApiErrorBody).error?.message === 'string'

const readErrorResponse = async (
  response: Response,
  kind: 'http' | 'protocol' = 'http',
  fallback = response.statusText
): Promise<ApiError> => {
  const text = await response.text().catch(() => '')
  let message = text || fallback
  try {
    const body: unknown = JSON.parse(text)
    if (isErrorBody(body)) {
      message = body.error.message
    }
  } catch {
    // 非 JSON 响应体直接展示原文
  }
  return new ApiError(kind, message, response.status)
}

export const request = async (url: string, init: RequestInit): Promise<Response> => {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (init.signal?.aborted) {
      throw error
    }
    throw new ApiError('network', error instanceof Error ? error.message : String(error))
  }
  if (!response.ok) {
    throw await readErrorResponse(response)
  }
  return response
}

export const apiUrl = ({ baseUrl, corsProxy }: ApiConnection, path: string) => {
  const target = `${baseUrl.trim().replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  let proxy = corsProxy?.trim()
  if (!proxy) {
    return target
  }
  // 允许用户只填域名/IP；浏览器环境下缺省按 https 处理，避免生成相对地址
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(proxy)) {
    proxy = `https://${proxy}`
  }
  if (proxy.includes('{url}')) {
    return proxy.replaceAll('{url}', encodeURIComponent(target))
  }
  if (proxy.includes('{rawUrl}')) {
    return proxy.replaceAll('{rawUrl}', target)
  }
  // 兼容常见前缀写法：裸地址默认追加 /?url=，已有 ?url=/结尾/= 时直接追加目标
  if (!/[/?]$/.test(proxy) && !/=$/.test(proxy) && !/[?&]url=?$/i.test(proxy)) {
    proxy += proxy.includes('?') ? '&url=' : '/?url='
  }
  return `${proxy}${encodeURIComponent(target)}`
}

const authHeaders = (protocol: ApiProtocol, apiKey: string): Record<string, string> =>
  protocol === 'anthropic'
    ? {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // 允许从静态页面的浏览器直接调用 Anthropic API
        'anthropic-dangerous-direct-browser-access': 'true',
      }
    : { Authorization: `Bearer ${apiKey}` }

const anthropicHeaders = (apiKey: string, beta: boolean): Record<string, string> => ({
  // Anthropic 兼容接口的常见鉴权方式；多数网关也接受 Authorization: Bearer。
  'x-api-key': apiKey,
  'anthropic-version': ANTHROPIC_VERSION,
  'anthropic-dangerous-direct-browser-access': 'true',
  // Files API 和通过 file_id 引用图片时必传；纯文本聊天无需携带。
  ...(beta ? { 'anthropic-beta': FILES_BETA } : {}),
})

/** 用 GET /models 校验 API Key（不产生费用） */
export const verifyApiKey = async (
  connection: ApiConnection,
  apiKey: string,
  signal?: AbortSignal
): Promise<void> => {
  await request(apiUrl(connection, '/models'), {
    method: 'GET',
    headers: authHeaders(connection.protocol, apiKey),
    signal,
  })
}

export type ModelInfo = { id: string; name?: string; contextWindow?: number }

type UnknownRecord = Record<string, unknown>

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined

const nestedNumber = (record: UnknownRecord, key: string, field: string): number | undefined => {
  const nested = record[key]
  return typeof nested === 'object' && nested !== null
    ? positiveNumber((nested as UnknownRecord)[field])
    : undefined
}

/** 解析各服务商 /models 常见的上下文字段，兼容 OpenAI、Anthropic、OpenRouter、Kimi 等 */
const readContextWindow = (record: UnknownRecord): number | undefined =>
  [
    positiveNumber(record.context_length),
    positiveNumber(record.max_input_tokens),
    positiveNumber(record.context_window),
    positiveNumber(record.contextWindow),
    positiveNumber(record.max_context_length),
    positiveNumber(record.maxContextLength),
    positiveNumber(record.max_model_len),
    positiveNumber(record.input_token_limit),
    nestedNumber(record, 'top_provider', 'context_length'),
    nestedNumber(record, 'limit', 'context'),
    nestedNumber(record, 'meta', 'n_ctx_train'),
  ].find((value) => value !== undefined)

const readModelId = (value: unknown): ModelInfo | null => {
  if (typeof value === 'string') {
    return { id: value }
  }
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as UnknownRecord
  const id = [record.id, record.name, record.model].find(
    (item): item is string => typeof item === 'string' && item.trim() !== ''
  )
  if (!id) {
    return null
  }
  const name = [record.display_name, record.displayName, record.name].find(
    (item): item is string => typeof item === 'string' && item !== id
  )
  return {
    id: id.startsWith('models/') ? id.slice('models/'.length) : id,
    name,
    contextWindow: readContextWindow(record),
  }
}

/** GET /models：读取服务商提供的模型列表，兼容 OpenAI 与 Anthropic 的响应结构 */
export const listModels = async (
  connection: ApiConnection,
  apiKey: string,
  signal?: AbortSignal
): Promise<ModelInfo[]> => {
  const path = connection.protocol === 'anthropic' ? '/models?limit=1000' : '/models'
  const response = await request(apiUrl(connection, path), {
    method: 'GET',
    headers: authHeaders(connection.protocol, apiKey),
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  const candidates = Array.isArray(body)
    ? body
    : typeof body === 'object' && body !== null
      ? ((body as Record<string, unknown>).data ?? (body as Record<string, unknown>).models ?? [])
      : []
  const seen = new Set<string>()
  const models: ModelInfo[] = []
  for (const item of Array.isArray(candidates) ? candidates : []) {
    const model = readModelId(item)
    if (model && !seen.has(model.id)) {
      seen.add(model.id)
      models.push(model)
    }
  }
  return models.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * POST /files 上传附件（仅 DeepSeek 扩展接口）。
 * purpose 为 null 时不传该字段（图片）；purpose 必须排在 file 之前。
 */
export const uploadFile = async (
  connection: ApiConnection,
  apiKey: string,
  file: File,
  purpose: FilePurpose | null,
  signal?: AbortSignal
): Promise<FileObject> => {
  const form = new FormData()
  if (purpose) {
    form.append('purpose', purpose)
  }
  form.append('file', file)
  const response = await request(apiUrl(connection, '/files'), {
    method: 'POST',
    headers: anthropicHeaders(apiKey, true),
    body: form,
    signal,
  })
  return (await response.json()) as FileObject
}

/** DELETE /files/{file_id} */
export const deleteFile = async (
  connection: ApiConnection,
  apiKey: string,
  fileId: string
): Promise<void> => {
  await request(apiUrl(connection, `/files/${encodeURIComponent(fileId)}`), {
    method: 'DELETE',
    headers: anthropicHeaders(apiKey, true),
  })
}

export type AnthropicMessageBody = {
  model: string
  messages: unknown[]
  system?: string
  stream?: boolean
  max_tokens?: number
  [key: string]: unknown
}

/**
 * POST /messages（stream: true），逐个产出流式事件，收到 message_stop 时结束。
 * ping、保活注释与无法解析的内容不产出；中止请求时抛出 signal 的 AbortError。
 */
export async function* streamMessage(
  connection: ApiConnection,
  apiKey: string,
  body: AnthropicMessageBody,
  signal: AbortSignal,
  fileBeta = false
): AsyncGenerator<MessageStreamEvent> {
  const response = await request(apiUrl(connection, '/messages'), {
    method: 'POST',
    headers: {
      ...anthropicHeaders(apiKey, fileBeta),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  })
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.body || !contentType.includes('text/event-stream')) {
    throw await readErrorResponse(response, 'protocol', '')
  }
  for await (const { event: eventName, data } of readServerSentEvents(response.body, signal)) {
    let payload: unknown
    try {
      payload = JSON.parse(data)
    } catch {
      if (eventName !== 'error') {
        continue
      }
    }
    if (isErrorBody(payload)) {
      throw new ApiError('stream', payload.error.message)
    }
    if (eventName === 'error') {
      throw new ApiError('stream', data)
    }
    const event = readMessageEvent(payload)
    if (!event) {
      continue
    }
    yield event
    if (event.type === 'message_stop') {
      return
    }
  }
  // 服务端没有提供错误内容时保持为空，不推测断流原因。
  throw new ApiError('interrupted', '')
}

type OpenAIUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
}

type OpenAIChunk = {
  id?: string
  model?: string
  choices?: {
    delta?: {
      content?: string | null
      reasoning?: string | null
      reasoning_content?: string | null
    }
    finish_reason?: string | null
  }[]
  usage?: OpenAIUsage
  error?: { message?: string }
}

const toUsage = (usage: OpenAIUsage | undefined): MessageUsage | undefined =>
  usage
    ? {
        input_tokens: usage.prompt_tokens ?? 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
      }
    : undefined

const toStopReason = (reason: string | null | undefined) => {
  switch (reason) {
    case 'length':
      return 'max_tokens'
    case 'tool_calls':
    case 'function_call':
      return 'tool_use'
    case 'content_filter':
      return 'refusal'
    default:
      return 'end_turn'
  }
}

export type OpenAIChatBody = {
  model: string
  messages: { role: 'system' | 'user' | 'assistant'; content: unknown }[]
  stream?: boolean
  [key: string]: unknown
}

/**
 * POST /chat/completions，stream: true；将 OpenAI 流式响应转换为 Messages 事件。
 * thinking 仅用于内部开关，不直接透传给服务商，避免不兼容字段导致 400。
 */
export async function* streamOpenAIMessage(
  connection: ApiConnection,
  apiKey: string,
  body: OpenAIChatBody & { thinking?: boolean },
  signal: AbortSignal
): AsyncGenerator<MessageStreamEvent> {
  const { thinking, ...rest } = body
  const response = await request(apiUrl(connection, '/chat/completions'), {
    method: 'POST',
    headers: {
      ...authHeaders('openai', apiKey),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      ...rest,
      stream: true,
      stream_options: { include_usage: true },
      ...(thinking ? { reasoning_effort: 'medium' } : {}),
    }),
    signal,
  })
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.body || !contentType.includes('text/event-stream')) {
    throw await readErrorResponse(response, 'protocol', '')
  }

  let started = false
  let messageId = ''
  let model = body.model
  let usage: MessageUsage | undefined
  let finishReason: string | null | undefined
  let blockIndex = -1
  let blockType: 'text' | 'thinking' | null = null

  for await (const { data } of readServerSentEvents(response.body, signal)) {
    if (data === '[DONE]') {
      break
    }
    let chunk: OpenAIChunk
    try {
      chunk = JSON.parse(data) as OpenAIChunk
    } catch {
      continue
    }
    if (chunk.error?.message) {
      throw new ApiError('stream', chunk.error.message)
    }
    if (!started) {
      started = true
      messageId = chunk.id ?? `msg_${Date.now()}`
      model = chunk.model ?? model
      yield { type: 'message_start', message: { id: messageId, model } }
    }
    if (chunk.usage) {
      usage = toUsage(chunk.usage)
    }
    const choice = chunk.choices?.[0]
    if (!choice) {
      continue
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason
    }
    const delta = choice.delta
    if (!delta) {
      continue
    }
    const reasoning = delta.reasoning_content ?? delta.reasoning
    if (reasoning) {
      if (blockType !== 'thinking') {
        if (blockType !== null) {
          yield { type: 'content_block_stop', index: blockIndex }
        }
        blockIndex += 1
        blockType = 'thinking'
        yield {
          type: 'content_block_start',
          index: blockIndex,
          content_block: { type: 'thinking', thinking: '', signature: '' },
        }
      }
      yield {
        type: 'content_block_delta',
        index: blockIndex,
        delta: { type: 'thinking_delta', thinking: reasoning },
      }
    }
    if (typeof delta.content === 'string' && delta.content !== '') {
      if (blockType !== 'text') {
        if (blockType !== null) {
          yield { type: 'content_block_stop', index: blockIndex }
        }
        blockIndex += 1
        blockType = 'text'
        yield {
          type: 'content_block_start',
          index: blockIndex,
          content_block: { type: 'text', text: '' },
        }
      }
      yield {
        type: 'content_block_delta',
        index: blockIndex,
        delta: { type: 'text_delta', text: delta.content },
      }
    }
  }

  if (!started) {
    throw new ApiError('interrupted', '')
  }
  if (blockType !== null) {
    yield { type: 'content_block_stop', index: blockIndex }
  }
  yield {
    type: 'message_delta',
    delta: { stop_reason: toStopReason(finishReason), stop_sequence: null },
    usage,
  }
  yield { type: 'message_stop' }
}

export type { CreateMessageRequest }
