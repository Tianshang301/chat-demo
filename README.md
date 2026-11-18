# chat-demo

English | [简体中文](README.zh-CN.md)

A static chat demo for OpenAI Chat Completions and Anthropic Messages compatible APIs. No application backend is required: the browser connects directly to the configured API service. DeepSeek remains the default and keeps its search, file, title, and speech extensions.

You can [try the app online](https://deepseek-ai.github.io/chat-demo/) or download the archive from [Releases](https://github.com/deepseek-ai/deepseek-chat-demo/releases), extract it, and double-click `index.html` to use it locally without installation or a build. Enter your API key in Settings before your first chat.

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/deepseek-ai/chat-demo.git
cd chat-demo
pnpm install
pnpm dev
```

Open http://localhost:8090.

To build the static site:

```sh
pnpm build
```

The output is written to `dist/`. Deploy it to a static web server or open `dist/index.html` directly. Opening the file directly requires browser support for storage on `file://` pages and an API service that permits their cross-origin requests.

## API configuration

Open **Settings → API**, pick a provider preset, or edit the protocol and Base URL manually. The Base URL is the API root, not a full endpoint: the app appends `/models`, `/messages`, or `/chat/completions`. Use **Fetch models** to query `/models` for the current Base URL, search the results, and click a model to use it.

| Provider                   | Protocol  | Base URL                                                  | Example model             |
| -------------------------- | --------- | --------------------------------------------------------- | ------------------------- |
| DeepSeek (default)         | Anthropic | `https://api.deepseek.com/anthropic/v1`                   | `deepseek-flash`          |
| OpenAI                     | OpenAI    | `https://api.openai.com/v1`                               | `gpt-6.2-sol`             |
| Anthropic                  | Anthropic | `https://api.anthropic.com/v1`                            | `claude-sonnet-5-5`       |
| Google Gemini (OpenAI)     | OpenAI    | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen`       |
| xAI Grok                   | OpenAI    | `https://api.x.ai/v1`                                     | `grok-4.7`                |
| OpenRouter                 | OpenAI    | `https://openrouter.ai/api/v1`                            | `openai/gpt-6.2-sol`      |
| SenseNova Token Plan       | OpenAI    | `https://token.sensenova.cn/v1`                           | `sensenova-6.8-flash-lite`|
| Alibaba Qwen (Intl)        | OpenAI    | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`  | `qwen3-coder-plus`        |
| Kimi (Moonshot Open Plat.) | OpenAI    | `https://api.moonshot.ai/v1`                              | `kimi-k2.5`               |
| Z.ai GLM                   | OpenAI    | `https://api.z.ai/api/paas/v4`                            | `glm-5.3`                 |
| Xiaomi MiMo                | OpenAI    | `https://api.xiaomimimo.com/v1`                           | `mimo-v2.6-pro`           |
| OpenCode Zen               | OpenAI    | `https://opencode.ai/zen/v1`                              | `glm-5.3`                 |
| Z.ai Coding Plan           | OpenAI    | `https://api.z.ai/api/coding/paas/v4`                     | `glm-5.3`            |
| Z.ai Coding Plan           | Anthropic | `https://api.z.ai/api/anthropic/v1`                       | `glm-5.3`            |
| Kimi Code                  | OpenAI    | `https://api.kimi.com/coding/v1`                          | `kimi-for-coding`    |
| Kimi Code                  | Anthropic | `https://api.kimi.com/coding/v1`                          | `kimi-for-coding`    |
| Alibaba Coding Plan (CN)   | OpenAI    | `https://coding.dashscope.aliyuncs.com/v1`                | `qwen3-coder-plus`   |
| Alibaba Coding Plan (intl) | OpenAI    | `https://coding-intl.dashscope.aliyuncs.com/v1`           | `qwen3-coder-plus`   |
| Xiaomi Token Plan (CN)     | OpenAI    | `https://token-plan-cn.xiaomimimo.com/v1`                 | `mimo-v2.6-pro`      |
| Xiaomi Token Plan (CN)     | Anthropic | `https://token-plan-cn.xiaomimimo.com/anthropic/v1`       | `mimo-v2.6-pro`      |
| OpenCode Go                | OpenAI    | `https://opencode.ai/inference/go/openai/v1`              | `glm-5.3`            |

> [!NOTE]
> **OAuth / subscription plans (Claude Pro/Max, ChatGPT/Codex, etc.)** cannot be used by pasting a Base URL and key. They rely on OAuth login, account-bound sessions, or dedicated clients. Use the provider’s official app, or a third-party API/gateway that exposes an OpenAI/Anthropic-compatible key (for example OpenRouter) if you want to use it here.
>
> **Browser CORS:** this app calls APIs directly from the browser. Providers that do not allow cross-origin requests from your site (common on GitHub Pages) will fail with `Network Error...`; set **Settings → API → CORS proxy** to a trusted proxy you control if needed. Public proxies may require a key or be unreliable.

Coding plans usually require a plan-specific key and Base URL, separate from the standard API. Some gateways do not implement GET /models; the key is still saved when only that endpoint is missing.

DeepSeek-specific features (smart search, link reading, Files API uploads, automatic server titles, voice input, and read-aloud) are only shown when the Base URL points to `api.deepseek.com`. Other providers support streaming text, reasoning output, and image attachments sent inline as base64 data URLs.

## Features

- Multiple conversations with automatic titles, renaming, and deletion; edit prompts, regenerate replies, and switch between message branches.
- Streaming replies, deep thinking, smart search, link reading, and source citations; stop generation or continue eligible replies.
- Upload, paste, or drag and drop attachments; use voice input and read replies aloud. A live audio spectrum appears in the first row of the input area while recording on mobile.
- Markdown, syntax highlighting, KaTeX math, and Mermaid diagrams.
- Simplified Chinese and English, light and dark themes, mobile layouts, location settings, and chat history import and export.

## Data and storage

Your API key and settings are stored in the browser's localStorage. Conversations and original attachments are stored in IndexedDB. Local data is isolated by browser profile and site origin. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation (Chinese)](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key and settings are preserved; files already uploaded to the API service are not deleted.

## Development

| Command       | Description                  |
| ------------- | ---------------------------- |
| `pnpm dev`    | Start the development server |
| `pnpm build`  | Build into `dist/`           |
| `pnpm type`   | Run TypeScript type checks   |
| `pnpm lint`   | Lint with oxlint             |
| `pnpm format` | Format with oxfmt            |

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy.

Chat uses `deepseek-flash` by default through Anthropic-compatible Messages / Files APIs. When the Base URL is not DeepSeek, requests use the standard OpenAI or Anthropic protocol, and speech features are hidden. DeepSeek requests include extensions for search, link reading, titles, and `latest_reminder`, so the configured service must support the corresponding capabilities. Supported attachment formats are determined by server-side validation.

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
