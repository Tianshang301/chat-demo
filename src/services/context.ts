import { getContextRounds } from './chat/reply.js'
import type { AssistantMessage, Message, UserMessage } from './chat/types.js'

/**
 * 已从官方文档核对的上下文窗口（tokens）。
 * 服务商 /models 返回的窗口优先；未返回时再使用这里的数据，均未知则不做截断。
 */
const KNOWN_CONTEXT_WINDOWS: [RegExp, number][] = [
  [/(?:^|\/)gpt-6\.2-sol(?:-pro)?$/, 1_050_000],
  [/(?:^|\/)claude-sonnet-5-5$/, 1_000_000],
  [/(?:^|\/)gemini-4-hydrogen$/, 1_048_576],
  [/(?:^|\/)grok-4\.7$/, 500_000],
  [/(?:^|\/)deepseek-flash$/, 1_000_000],
  [/(?:^|\/)qwen3-coder-plus$/, 1_000_000],
  [/(?:^|\/)kimi-k2\.5$/, 262_144],
  [/(?:^|\/)glm-5\.3(?:-flash|-flashx)?$/, 1_000_000],
  [/(?:^|\/)mimo-v2\.6-pro(?:-ultraspeed)?$/, 1_000_000],
  [/(?:^|\/)kimi-for-coding$/, 262_144],
]

/** 按已核对的模型名查找窗口；未知返回 null，避免用猜测值截断对话。 */
export const estimateContextWindow = (model: string): number | null => {
  const id = model.trim()
  for (const [pattern, window] of KNOWN_CONTEXT_WINDOWS) {
    if (pattern.test(id)) {
      return window
    }
  }
  return null
}

/** 粗略估算文本 token：CJK 约 1 token/字，其他约 4 字符/token。 */
export const estimateTextTokens = (text: string): number => {
  let units = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    units += code > 0x2e80 ? 4 : 1
  }
  return Math.ceil(units / 4)
}

const estimateFileTokens = (file: { isImage: boolean; size: number }): number =>
  file.isImage ? 1_200 : Math.min(100_000, Math.ceil(file.size / 4))

/** 单条消息的估算成本，包含图片和文档的保守开销。 */
export const estimateMessageTokens = (message: UserMessage | AssistantMessage): number => {
  const text =
    message.role === 'user'
      ? message.content
      : message.blocks
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')
  const files = message.role === 'user' ? message.files : []
  return (
    4 +
    estimateTextTokens(text) +
    files.reduce((total, file) => total + estimateFileTokens(file), 0)
  )
}

/** 发送时为输出预留的 token；窗口较小时同步缩小。 */
export const outputTokenReserve = (contextWindow: number): number =>
  Math.min(8_192, Math.max(1_024, Math.floor(contextWindow / 10)))

export type TrimmedHistory = {
  history: Message[]
  /** 因窗口不足被省略的轮次数 */
  dropped: number
  /** 保留的历史估算 token */
  tokens: number
}

/**
 * 从最新一轮往前保留历史，直到达到预算；整轮丢弃，避免拆散提问与回答。
 * 预算由调用方扣除 system、本轮提问和输出预留后再传入。
 */
export const trimHistoryToBudget = (history: Message[], budget: number): TrimmedHistory => {
  const rounds = getContextRounds(history)
  let tokens = 0
  let keepFrom = rounds.length
  for (let index = rounds.length - 1; index >= 0; index--) {
    const [user, reply] = rounds[index]
    const cost = estimateMessageTokens(user) + estimateMessageTokens(reply)
    if (tokens + cost > budget) {
      break
    }
    tokens += cost
    keepFrom = index
  }
  if (keepFrom === 0) {
    return { history, dropped: 0, tokens }
  }
  const kept = new Set(
    rounds.slice(keepFrom).flatMap(([user, reply]) => [user.id, reply.id])
  )
  return {
    history: history.filter((message) => kept.has(message.id)),
    dropped: keepFrom,
    tokens,
  }
}

/** 128000 → 128K，便于设置页展示 */
export const formatTokenCount = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${Math.round(tokens / 100_000) / 10}M`
    : tokens >= 1_000
      ? `${Math.round(tokens / 1_000)}K`
      : String(tokens)
