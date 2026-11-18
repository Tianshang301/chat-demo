import { useEffect, useState } from 'react'
import { createViewUrl } from '../../services/fileView.js'

/**
 * 原件可直接查看时的本地地址，卸载或换原件时释放。
 * undefined 表示判定中或没有原件，null 表示内容不能直接查看、只能下载。
 */
export const useViewUrl = (blob: Blob | null, isImage: boolean): string | null | undefined => {
  const [state, setState] = useState<{ blob: Blob; url: string | null } | null>(null)
  useEffect(() => {
    if (!blob) {
      return
    }
    let url: string | null = null
    let cancelled = false
    createViewUrl(blob, isImage)
      // 原件读不出来时按不能查看处理
      .catch(() => null)
      .then((created) => {
        if (cancelled) {
          if (created) {
            URL.revokeObjectURL(created)
          }
          return
        }
        url = created
        setState({ blob, url: created })
      })
    return () => {
      cancelled = true
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [blob, isImage])
  return blob && state?.blob === blob ? state.url : undefined
}
