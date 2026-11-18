import { useState } from 'react'
import { ApiError, verifyApiKey } from '../../services/api/client.js'
import { classifyApiError } from '../../services/api/errors.js'
import { setApiKey, useSettings } from '../../services/settings.js'
import { useTranslate } from '../../i18n/index.js'

/** 输入 API Key 后先用 GET /models 校验，通过才保存 */
export const useApiKeyForm = (onSaved?: () => void) => {
  const t = useTranslate()
  const [value, setValue] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [failure, setFailure] = useState<{ cause: unknown; baseUrl?: boolean } | null>(null)
  const cause = failure?.cause
  const error =
    failure === null
      ? null
      : failure.baseUrl
        ? t('apiBaseUrlInvalid')
        : classifyApiError(cause) === 'unauthorized'
          ? t('apiKeyInvalid')
          : classifyApiError(cause) === 'network'
            ? t('commonNetworkErrorToast')
            : t('apiKeyVerificationFailed', {
                message:
                  cause instanceof ApiError && cause.localMessage
                    ? t(cause.localMessage.key, cause.localMessage.params)
                    : cause instanceof Error
                      ? cause.message
                      : String(cause),
              })

  const submit = async () => {
    const apiKey = value.trim()
    if (!apiKey || verifying) {
      return
    }
    const { apiProtocol, baseUrl, corsProxy } = useSettings.getState()
    if (!/^https?:\/\/\S+/i.test(baseUrl)) {
      setFailure({ cause: null, baseUrl: true })
      return
    }
    setVerifying(true)
    setFailure(null)
    try {
      try {
        await verifyApiKey({ protocol: apiProtocol, baseUrl, corsProxy }, apiKey)
      } catch (e) {
        // 部分兼容网关不实现 GET /models，只要不是鉴权或网络错误就允许保存
        if (!(e instanceof ApiError && (e.status === 404 || e.status === 405))) {
          throw e
        }
      }
      setApiKey(apiKey)
      setValue('')
      onSaved?.()
    } catch (e) {
      setFailure({ cause: e })
    } finally {
      setVerifying(false)
    }
  }

  return { value, setValue, verifying, error, submit }
}
