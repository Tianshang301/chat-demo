import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { ApiError, listModels, type ModelInfo } from '../../services/api/client.js'
import { estimateContextWindow, formatTokenCount } from '../../services/context.js'
import {
  applyApiConfig,
  setApiProtocol,
  setBaseUrl,
  setCorsProxy,
  setModel,
  useSettings,
} from '../../services/settings.js'
import {
  CUSTOM_PRESET_ID,
  PROVIDER_PRESETS,
  findPreset,
  presetLabel,
  type ApiProtocol,
} from '../../services/providers.js'
import { Button } from '../base/Button.js'
import { Select } from '../base/Select.js'
import { ApiKeyField, type ApiKeyEditor } from './ApiKeyField.js'
import styles from './Settings.module.css'

const protocolOptions: { value: ApiProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI Chat Completions' },
  { value: 'anthropic', label: 'Anthropic Messages' },
]

/** 接口设置：服务商预设、协议、Base URL、模型与 API Key */
export const ApiSettings = ({ editor }: { editor: ApiKeyEditor }) => {
  const t = useTranslate()
  const apiProtocol = useSettings((state) => state.apiProtocol)
  const baseUrl = useSettings((state) => state.baseUrl)
  const corsProxy = useSettings((state) => state.corsProxy)
  const model = useSettings((state) => state.model)
  const contextWindow = useSettings((state) => state.contextWindow)
  const preset = findPreset(apiProtocol, baseUrl, model)
  const validBaseUrl = !baseUrl || /^https?:\/\/[^\s]+$/i.test(baseUrl)
  const apiKey = useSettings((state) => state.apiKey)
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // 切换协议、Base URL 或代理时清空模型列表和错误
  useEffect(() => {
    setModels(null)
    setModelError(null)
    setQuery('')
  }, [apiProtocol, baseUrl, corsProxy])

  const fetchModels = async () => {
    if (!apiKey) {
      setModelError(t('apiModelsNeedKey'))
      return
    }
    if (!validBaseUrl || fetching) {
      return
    }
    setFetching(true)
    setModelError(null)
    try {
      const list = await listModels({ protocol: apiProtocol, baseUrl, corsProxy }, apiKey)
      setModels(list)
      if (list.length === 0) {
        setModelError(t('apiModelsEmpty'))
      }
    } catch (error) {
      setModelError(
        t('apiModelsFailed', {
          message:
            error instanceof ApiError && error.localMessage
              ? t(error.localMessage.key, error.localMessage.params)
              : error instanceof Error
                ? error.message
                : String(error),
        })
      )
    } finally {
      setFetching(false)
    }
  }

  const filtered = models?.filter((item) => {
    const keyword = query.trim().toLowerCase()
    return (
      keyword === '' ||
      item.id.toLowerCase().includes(keyword) ||
      (item.name?.toLowerCase().includes(keyword) ?? false)
    )
  })

  return (
    <>
      <div className={styles.cell}>
        <div className={styles.apiConfig}>
          <div className={styles.label}>{t('apiProviderPreset')}</div>
          <Select
            ariaLabel={t('apiProviderPreset')}
            className={styles.presetSelect}
            value={preset?.id ?? CUSTOM_PRESET_ID}
            options={[
              { value: CUSTOM_PRESET_ID, label: t('apiProviderCustom') },
              ...PROVIDER_PRESETS.map((item) => ({
                value: item.id,
                label: presetLabel(item),
              })),
            ]}
            onChange={(id) => {
              const next = PROVIDER_PRESETS.find((item) => item.id === id)
              if (next) {
                applyApiConfig({
                  apiProtocol: next.protocol,
                  baseUrl: next.baseUrl,
                  model: next.model,
                })
              }
            }}
          />
          <div className={styles.description}>{t('apiCodingPlanHint')}</div>
        </div>
      </div>

      <div className={styles.cell}>
        <div className={styles.apiConfig}>
          <div className={styles.label}>{t('apiProtocol')}</div>
          <Select
            ariaLabel={t('apiProtocol')}
            className={styles.presetSelect}
            value={apiProtocol}
            options={protocolOptions.map((option) => ({
              value: option.value,
              label: t(option.value === 'openai' ? 'apiProtocolOpenAI' : 'apiProtocolAnthropic'),
            }))}
            onChange={setApiProtocol}
          />
        </div>
      </div>

      <div className={styles.cell}>
        <div className={styles.apiConfig}>
          <label className={styles.label} htmlFor="api-base-url">
            {t('apiBaseUrl')}
          </label>
          <input
            id="api-base-url"
            className={styles.textInput}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('apiBaseUrlPlaceholder')}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
          {validBaseUrl ? (
            <div className={styles.description}>{t('apiBaseUrlDescription')}</div>
          ) : (
            <div className={styles.error}>{t('apiBaseUrlInvalid')}</div>
          )}
        </div>
      </div>

      <div className={styles.cell}>
        <div className={styles.apiConfig}>
          <label className={styles.label} htmlFor="api-cors-proxy">
            {t('apiCorsProxy')}
          </label>
          <input
            id="api-cors-proxy"
            className={styles.textInput}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('apiCorsProxyPlaceholder')}
            value={corsProxy}
            onChange={(event) => setCorsProxy(event.target.value)}
          />
          <div className={styles.description}>{t('apiCorsProxyDescription')}</div>
        </div>
      </div>

      <div className={styles.cell}>
        <div className={styles.apiConfig}>
          <label className={styles.label} htmlFor="api-model">
            {t('apiModel')}
          </label>
          <input
            id="api-model"
            className={styles.textInput}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('apiModelPlaceholder')}
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
          <div className={styles.description}>
            {contextWindow === null
              ? t('apiContextWindowUnknown')
              : t('apiContextWindow', { tokens: formatTokenCount(contextWindow) })}
          </div>
          <div className={styles.description}>{t('apiCacheMissHint')}</div>
        </div>
      </div>

      <div className={styles.cell}>
        <div className={styles.apiConfig}>
          <div className={styles.modelTools}>
            <input
              className={styles.textInput}
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('apiSearchModels')}
              value={query}
              disabled={!models}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button
              variant="outlined"
              size="m"
              className={styles.modelFetchButton}
              disabled={fetching || !validBaseUrl}
              onClick={() => void fetchModels()}
            >
              {t(fetching ? 'apiFetchingModels' : 'apiFetchModels')}
            </Button>
          </div>
          {modelError ? (
            <div className={styles.error}>{modelError}</div>
          ) : models ? (
            <>
              <div className={styles.description}>
                {t('apiModelsLoaded', { count: models.length })}
              </div>
              <div className={styles.modelList} role="listbox" aria-label={t('apiSearchModels')}>
                {filtered?.length ? (
                  filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === model}
                      title={t('apiUseModel')}
                      className={item.id === model ? styles.modelItemSelected : styles.modelItem}
                      onClick={() =>
                        setModel(item.id, item.contextWindow ?? estimateContextWindow(item.id))
                      }
                    >
                      <span className={styles.modelId}>
                        {item.id}
                        {item.contextWindow ? ` · ${formatTokenCount(item.contextWindow)}` : ''}
                      </span>
                      {item.name ? <span className={styles.modelName}>{item.name}</span> : null}
                    </button>
                  ))
                ) : (
                  <div className={styles.description}>{t('apiModelsEmpty')}</div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <ApiKeyField editor={editor} />
    </>
  )
}
