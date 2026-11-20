import { ApiError, request } from './client.js'

export const TTS_SAMPLE_RATE = 24000

export type SpeechProvider = 'deepseek' | 'xiaomi' | 'minimax' | 'openai'

export type SpeechConfig = {
  provider: SpeechProvider
  baseUrl: string
  apiKey: string
  model: string
  voice?: string
  language?: string
}

const trimBase = (baseUrl: string) => baseUrl.replace(/\/+$/, '')
const toBytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

const hexToBytes = (hex: string) => {
  const clean = hex.trim()
  const out = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

async function* parseSseData(stream: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const onAbort = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let idx = buf.indexOf('\n\n')
      while (idx !== -1) {
        const block = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) {
            continue
          }
          const data = line.slice(5).trimStart()
          if (data && data !== '[DONE]') {
            yield data
          }
        }
        idx = buf.indexOf('\n\n')
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }
}

const getJsonPath = (value: unknown, path: string[]): unknown => {
  let current: unknown = value
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const sseBytesStream = (
  response: Response,
  pick: (json: unknown) => Uint8Array | null,
  signal: AbortSignal
) => {
  if (!response.body) {
    throw new ApiError('protocol', 'Empty response body')
  }
  const sse = parseSseData(response.body, signal)
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const { value, done } = await sse.next()
          if (done) {
            controller.close()
            return
          }
          let json: unknown
          try {
            json = JSON.parse(value)
          } catch {
            continue
          }
          const bytes = pick(json)
          if (bytes && bytes.length) {
            controller.enqueue(bytes)
            return
          }
        }
      } catch (e) {
        controller.error(e)
      }
    },
    cancel() {
      void sse.return(undefined)
    },
  })
}

const streamAudioResponse = (response: Response): ReadableStream<Uint8Array> => {
  if (response.body) {
    return response.body
  }
  throw new ApiError('protocol', 'Empty response body')
}

const normalizeForTts = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const synthesizeSpeech = async (
  config: SpeechConfig,
  text: string,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> => {
  const base = trimBase(config.baseUrl)
  const { provider, apiKey, model, voice } = config
  const input = normalizeForTts(text) || text

  if (provider === 'deepseek') {
    const response = await request(`${base}/tts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        model: model || undefined,
        voice_id: voice || 'stella',
        format: 'pcm',
        filter_markdown: true,
      }),
      signal,
    })
    return streamAudioResponse(response)
  }

  if (provider === 'xiaomi') {
    const response = await request(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'mimo-v2.5-tts',
        messages: [
          { role: 'user', content: 'Read the following text naturally and clearly.' },
          { role: 'assistant', content: input },
        ],
        audio: { format: 'pcm16', voice: voice || 'mimo_default' },
        stream: true,
      }),
      signal,
    })
    return sseBytesStream(
      response,
      (json) => {
        const b64 = getJsonPath(json, ['choices', '0', 'delta', 'audio', 'data'])
        return typeof b64 === 'string' && b64 ? toBytes(b64) : null
      },
      signal
    )
  }

  if (provider === 'minimax') {
    const response = await request(`${base}/t2a_v2`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'speech-2.8-hd',
        text: input,
        stream: true,
        output_format: 'hex',
        voice_setting: { voice_id: voice || 'male-qn-qingse' },
        audio_setting: { format: 'pcm', sample_rate: 24000, channel: 1 },
      }),
      signal,
    })
    return sseBytesStream(
      response,
      (json) => {
        const hex = getJsonPath(json, ['data', 'audio'])
        return typeof hex === 'string' && hex ? hexToBytes(hex) : null
      },
      signal
    )
  }

  const response = await request(`${base}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini-tts',
      input,
      voice: voice || 'alloy',
      response_format: 'pcm',
    }),
    signal,
  })
  return streamAudioResponse(response)
}

const parseJsonResponse = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new ApiError('protocol', raw)
  }
}

const readTextField = (body: unknown, raw: string): string => {
  const text = getJsonPath(body, ['text'])
  if (typeof text !== 'string') {
    throw new ApiError('protocol', raw)
  }
  return text
}

export const transcribeSpeech = async (
  config: SpeechConfig,
  audio: Blob,
  signal?: AbortSignal
): Promise<string> => {
  const base = trimBase(config.baseUrl)
  const { provider, apiKey, model, language } = config

  if (provider === 'deepseek') {
    const form = new FormData()
    form.append('file', audio, 'recording.wav')
    if (model) {
      form.append('model', model)
    }
    const response = await request(`${base}/asr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    })
    const raw = await response.text()
    return readTextField(parseJsonResponse(raw), raw)
  }

  if (provider === 'xiaomi') {
    const buf = await audio.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i])
    }
    const b64 = btoa(bin)
    const mime = audio.type || 'audio/wav'
    const response = await request(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'mimo-v2.5-asr',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: `data:${mime};base64,${b64}`,
                  format: mime.includes('mp3') || mime.includes('mpeg') ? 'mp3' : 'wav',
                },
              },
            ],
          },
        ],
        asr_options: { language: language || 'auto' },
      }),
      signal,
    })
    const raw = await response.text()
    const body = parseJsonResponse(raw)
    const text = getJsonPath(body, ['choices', '0', 'message', 'content'])
    if (typeof text !== 'string') {
      throw new ApiError('protocol', raw)
    }
    return text
  }

  if (provider === 'minimax') {
    const form = new FormData()
    form.append('model', model || 'asr-1.0')
    form.append('file', audio, 'recording.wav')
    form.append('response_format', 'json')
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
    if (language && language !== 'auto') {
      headers.language = language
    }
    const response = await request(`${base}/speech_to_text`, {
      method: 'POST',
      headers,
      body: form,
      signal,
    })
    const raw = await response.text()
    return readTextField(parseJsonResponse(raw), raw)
  }

  const form = new FormData()
  form.append('model', model || 'gpt-4o-mini-transcribe')
  form.append('file', audio, 'recording.wav')
  if (language && language !== 'auto') {
    form.append('language', language)
  }
  const response = await request(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  })
  const raw = await response.text()
  return readTextField(parseJsonResponse(raw), raw)
}
