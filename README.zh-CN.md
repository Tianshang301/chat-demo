# chat-demo

[English](README.md) | 简体中文

支持 OpenAI Chat Completions 与 Anthropic Messages 兼容接口的静态聊天示例。无需应用后端，浏览器直接请求配置的 API 服务。默认使用 DeepSeek，并保留其搜索、文件、标题和语音扩展。

点击 [在线体验](https://deepseek-ai.github.io/chat-demo/) 即可使用，也可以前往 [Releases](https://github.com/deepseek-ai/deepseek-chat-demo/releases) 下载压缩包，解压后双击 `index.html` 在本地使用，无需安装或构建。首次使用时，请在设置中填写 API Key。

## 运行

准备 Node.js 22.12+ 和 pnpm：

```sh
git clone https://github.com/deepseek-ai/chat-demo.git
cd chat-demo
pnpm install
pnpm dev
```

打开 http://localhost:8090 。

生成静态产物：

```sh
pnpm build
```

产物位于 `dist/`，可部署到静态服务器，也可直接打开 `dist/index.html`。直接打开时，浏览器和 API 服务需允许 `file://` 页面的存储与跨域请求。

## 接口设置

打开 **设置 → 接口设置**，选择服务商预设，或手动修改协议和 Base URL。Base URL 是 API 根地址，不是完整端点：应用会自动拼接 `/models`、`/messages` 或 `/chat/completions`。点击 **获取模型列表** 会请求当前 Base URL 的 `/models`，可搜索并点击选用。

| 服务商                     | 协议      | Base URL                                                  | 模型示例             |
| -------------------------- | --------- | --------------------------------------------------------- | -------------------- |
| DeepSeek                   | Anthropic | `https://api.deepseek.com/anthropic/v1`                   | `deepseek-flash`     |
| OpenAI                     | OpenAI    | `https://api.openai.com/v1`                               | `gpt-6.2-sol`        |
| Anthropic                  | Anthropic | `https://api.anthropic.com/v1`                            | `claude-sonnet-5-5`  |
| Google Gemini              | OpenAI    | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen`  |
| xAI Grok                   | OpenAI    | `https://api.x.ai/v1`                                     | `grok-4.7`           |
| OpenRouter                 | OpenAI    | `https://openrouter.ai/api/v1`                            | `openai/gpt-6.2-sol` |
| SenseNova Token Plan（商汤） | OpenAI    | `https://token.sensenova.cn/v1`                           | `sensenova-6.8-flash-lite` |
| 通义千问 API（国际）       | OpenAI    | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`  | `qwen3-coder-plus`   |
| Kimi 开放平台              | OpenAI    | `https://api.moonshot.ai/v1`                              | `kimi-k2.5`          |
| Z.ai API                   | OpenAI    | `https://api.z.ai/api/paas/v4`                            | `glm-5.3`            |
| 小米 MiMo API              | OpenAI    | `https://api.xiaomimimo.com/v1`                           | `mimo-v2.6-pro`      |
| OpenCode Zen               | OpenAI    | `https://opencode.ai/zen/v1`                              | `glm-5.3`            |
| Z.ai Coding Plan           | OpenAI    | `https://api.z.ai/api/coding/paas/v4`                     | `glm-5.3`            |
| Z.ai Coding Plan           | Anthropic | `https://api.z.ai/api/anthropic/v1`                       | `glm-5.3`            |
| Kimi Code                  | OpenAI    | `https://api.kimi.com/coding/v1`                          | `kimi-for-coding`    |
| Kimi Code                  | Anthropic | `https://api.kimi.com/coding/v1`                          | `kimi-for-coding`    |
| 阿里云 Coding Plan（国内） | OpenAI    | `https://coding.dashscope.aliyuncs.com/v1`                | `qwen3-coder-plus`   |
| 阿里云 Coding Plan（国际） | OpenAI    | `https://coding-intl.dashscope.aliyuncs.com/v1`           | `qwen3-coder-plus`   |
| 小米 Token Plan（国内）    | OpenAI    | `https://token-plan-cn.xiaomimimo.com/v1`                 | `mimo-v2.6-pro`      |
| 小米 Token Plan（国内）    | Anthropic | `https://token-plan-cn.xiaomimimo.com/anthropic/v1`       | `mimo-v2.6-pro`      |
| OpenCode Go                | OpenAI    | `https://opencode.ai/inference/go/openai/v1`              | `glm-5.3`            |

Coding Plan 通常需要套餐专用的 Key 和 Base URL，与普通 API 不同。Claude Pro/Max 与 ChatGPT/Codex 订阅使用 OAuth，不能仅靠 Base URL 接入，请改用 API Key。部分网关没有实现 `GET /models`，此时只要不是鉴权或网络错误，仍可保存 Key。

> [!NOTE]
> **浏览器跨域（CORS）：** 本应用在浏览器中直接请求 API。若服务商未允许跨域请求（GitHub Pages 部署时常见），可在 **设置 → 接口配置 → CORS 代理** 填写可信的 HTTPS 代理；或在本地运行 `pnpm dev`。SenseNova 本地开发可将 Base URL 设为 `http://localhost:8090/proxy/sensenova`（无需填写 CORS 代理）。

只有在 Base URL 指向 `api.deepseek.com` 时才显示 DeepSeek 专属功能（智能搜索、链接阅读、Files API 上传、服务端标题、语音输入和回复朗读）。其他服务商支持流式文本、思考内容和图片附件，图片会以内联 base64 数据发送。

## 功能

- 多会话、自动标题、重命名与删除；编辑提问、重新生成和切换消息分支。
- 流式回答、深度思考、智能搜索、链接阅读与来源引用；支持停止和符合条件的继续生成。
- 附件上传、粘贴与拖拽，语音输入和回复朗读；移动端录音时输入框首行显示实时频谱。
- Markdown、代码高亮、KaTeX 公式和 Mermaid 图表。
- 简体中文与英文、浅色与深色主题、移动端布局、位置设置、历史导入导出。

## 数据

API Key 和设置保存在浏览器 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源（origin）隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令          | 用途                |
| ------------- | ------------------- |
| `pnpm dev`    | 启动开发服务器      |
| `pnpm build`  | 构建到 `dist/`      |
| `pnpm type`   | TypeScript 类型检查 |
| `pnpm lint`   | oxlint 检查         |
| `pnpm format` | oxfmt 格式化        |

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理。

聊天默认使用 `deepseek-flash`，通过 Anthropic 兼容的 Messages / Files API 通信；Base URL 不是 DeepSeek 时改用标准 OpenAI 或 Anthropic 协议，并隐藏语音功能。DeepSeek 请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

```text
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  services/
    api/               API 请求、SSE 与协议类型
    chat/              会话、消息分支、本地存储与历史导入导出
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
```

## 许可证

[MIT](LICENSE)。构建会将许可证复制到 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
