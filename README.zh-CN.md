#> [!NOTE]
> **OAuth / 订阅类服务**（如 Claude Pro/Max、ChatGPT/Codex）不能通过填写 Base URL + Key 使用。它们依赖 OAuth 登录、账号会话或专用客户端。请使用官方客户端，或使用能提供 OpenAI/Anthropic 兼容 Key 的第三方 API/网关（如 OpenRouter）接入。
>
> **浏览器跨域（CORS）：** 本应用在浏览器中直接请求 API。若服务商未允许来自你的站点（GitHub Pages 部署时很常见）的跨域请求，会出现“网络异常…”；可在 **设置 → 接口配置 → CORS 代理** 填写可信的自建代理。公共代理可能需要密钥或不稳定。

Coding Plan 通常需要配套专用的 Key 和 Base URL，与普通 API 不同；部分网关未实现 `GET /models`，此时只要不是鉴权失败即可保存 Key。
