import { API_ORIGIN, streamMessage, type ApiConnection } from '../api/client.js'
import type { ServerToolBlock, WebSearchResult } from '../api/types.js'

export type SearchSource = {
  url: string
  title: string
  snippet: string
  publishedAt: string | null
}

export type SearchResult = {
  blocks: ServerToolBlock[]
  sources: SearchSource[]
  context: string
}

const MAX_SOURCES = 6
const MAX_SNIPPET_CHARS = 600

const clamp = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}...` : value

const collectSourcesFromBlocks = (blocks: ServerToolBlock[]): SearchSource[] => {
  const results = new Map<string, ServerToolBlock>()
  for (const block of blocks) {
    if (block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result') {
      results.set(block.tool_use_id, block)
    }
  }
  const seen = new Set<string>()
  const sources: SearchSource[] = []
  for (const block of blocks) {
    if (block.type !== 'server_tool_use') {
      continue
    }
    const result = results.get(block.id)
    if (result?.type === 'web_search_tool_result') {
      for (const item of result.content) {
        if (item.type === 'web_search_result' && !seen.has(item.url)) {
          seen.add(item.url)
          sources.push({
            url: item.url,
            title: item.title || item.url,
            snippet: item.snippet || '',
            publishedAt: item.page_age,
          })
        }
      }
    }
    if (sources.length >= MAX_SOURCES) {
      break
    }
  }
  return sources.slice(0, MAX_SOURCES)
}

export const formatSearchContext = (sources: SearchSource[]): string => {
  if (sources.length === 0) {
    return ''
  }
  const entries = sources.map((source, index) => {
    const lines = [`[${index + 1}] ${source.title}`, `URL: ${source.url}`]
    if (source.publishedAt) {
      lines.push(`Published: ${source.publishedAt}`)
    }
    if (source.snippet) {
      lines.push(`Snippet: ${clamp(source.snippet, MAX_SNIPPET_CHARS)}`)
    }
    return lines.join('\n')
  })
  return [
    'Web search results for the user question are below. Use them as supporting context. Cite sources inline as [citation:N] when a statement relies on result N. Do not invent facts or sources that are not present.',
    '',
    entries.join('\n\n'),
  ].join('\n')
}

const runDeepSeekSearchQuery = async (
  query: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  signal: AbortSignal
): Promise<SearchResult> => {
  const connection: ApiConnection = {
    protocol: 'anthropic',
    baseUrl: baseUrl || `${API_ORIGIN}/anthropic/v1`,
  }
  const blocks: ServerToolBlock[] = []
  let sawResult = false
  try {
    const events = streamMessage(
      connection,
      apiKey,
      {
        model: model || 'deepseek-flash',
        system:
          'You are a web search assistant. Use the deepseek_web_search tool to search for the given query, then stop. Do not answer the question.',
        messages: [{ role: 'user', content: [{ type: 'text', text: query }] }],
        thinking: { type: 'disabled' },
        safety_check: { level: 'high' },
        tools: [{ type: 'deepseek_web_search', name: 'deepseek_web_search' }],
      },
      signal
    )
    let textLen = 0
    let sawTool = false
    for await (const event of events) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        textLen += event.delta.text.length
        if (!sawTool && textLen > 240) {
          break
        }
        continue
      }
      if (event.type !== 'content_block_start') {
        continue
      }
      const block = event.content_block
      if (block.type === 'server_tool_use') {
        sawTool = true
        blocks.push(block)
      } else if (block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result') {
        sawResult = true
        blocks.push(block)
      } else if (block.type === 'text' && sawResult) {
        break
      }
    }
  } catch (error) {
    if (signal.aborted) {
      return { blocks: [], sources: [], context: '' }
    }
    throw error
  }
  const sources = collectSourcesFromBlocks(blocks)
  return { blocks, sources, context: formatSearchContext(sources) }
}

const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (value == null) {
    return ''
  }
  return String(value)
}

const runCustomSearchQuery = async (
  query: string,
  baseUrl: string,
  apiKey: string,
  _model: string,
  signal: AbortSignal
): Promise<SearchResult> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    signal,
  })
  const raw = await res.text().catch(() => '')
  let data: unknown = null
  try {
    data = raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const errObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
    const errField = errObj?.error
    const errMsg =
      (errField &&
        typeof errField === 'object' &&
        typeof (errField as Record<string, unknown>).message === 'string' &&
        ((errField as Record<string, unknown>).message as string)) ||
      (errObj && typeof errObj.message === 'string' && errObj.message) ||
      raw ||
      `HTTP ${res.status}`
    throw new Error(String(errMsg))
  }
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  const items: unknown[] = Array.isArray(obj?.results)
    ? (obj.results as unknown[])
    : Array.isArray(obj?.data)
      ? (obj.data as unknown[])
      : Array.isArray(obj?.items)
        ? (obj.items as unknown[])
        : Array.isArray(data)
          ? (data as unknown[])
          : []
  const sources: SearchSource[] = items
    .slice(0, MAX_SOURCES)
    .map((item) => {
      const it = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        url: asText(it.url ?? it.link ?? it.href),
        title: asText(it.title ?? it.name ?? it.url ?? 'Result'),
        snippet: asText(it.snippet ?? it.content ?? it.description ?? it.text ?? it.summary),
        publishedAt:
          asText(it.publishedAt ?? it.published_at ?? it.date ?? it.page_age) || null,
      }
    })
    .filter((s) => s.url)

  const toolId = `srvtoolu_s_${Date.now().toString(16)}`
  const searchResults: WebSearchResult[] = sources.map((s) => ({
    type: 'web_search_result',
    title: s.title,
    url: s.url,
    snippet: s.snippet,
    site_icon: null,
    site_name: null,
    encrypted_content: '',
    page_age: s.publishedAt,
  }))
  const blocks: ServerToolBlock[] = [
    {
      type: 'server_tool_use',
      id: toolId,
      name: 'deepseek_web_search',
      input: { action: 'search', query, queries: [query] },
      caller: { type: 'direct' },
      kind: 'search',
    },
    {
      type: 'web_search_tool_result',
      tool_use_id: toolId,
      content: searchResults,
      kind: 'search',
    },
  ]
  return { blocks, sources, context: formatSearchContext(sources) }
}

export type SearchProviderConfig = {
  provider: 'deepseek' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
}

export const executeWebSearch = async (
  query: string,
  config: SearchProviderConfig,
  signal: AbortSignal
): Promise<SearchResult> => {
  if (config.provider === 'custom') {
    if (!config.baseUrl) {
      return { blocks: [], sources: [], context: '' }
    }
    return runCustomSearchQuery(query, config.baseUrl, config.apiKey, config.model, signal)
  }
  if (!config.apiKey) {
    return { blocks: [], sources: [], context: '' }
  }
  return runDeepSeekSearchQuery(query, config.baseUrl, config.apiKey, config.model, signal)
}
