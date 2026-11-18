/**
 * 附件原件的查看与下载。
 * 原件内容与自带的 MIME 都不可信，而 blob: 文档与应用同源、能读到 localStorage，
 * 因此只为按内容判定出的安全类型生成可打开的地址，其余内容只能下载。
 */

/** 判定类型时读取的文件头长度 */
const SAMPLE_BYTES = 8192
/** 下载地址在点击后保留的时间，留给浏览器启动下载 */
const DOWNLOAD_URL_TTL_MS = 10_000

/** 从文件头识别位图 MIME；无法识别时为空字符串。 */
export const sniffImageType = (bytes: Uint8Array): string => {
  const startsWith = (...prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte)
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 12))
  if (startsWith(0xff, 0xd8, 0xff)) {
    return 'image/jpeg'
  }
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'image/png'
  }
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) {
    return 'image/gif'
  }
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (startsWith(0x42, 0x4d)) {
    return 'image/bmp'
  }
  if (startsWith(0x49, 0x49, 0x2a, 0) || startsWith(0x4d, 0x4d, 0, 0x2a)) {
    return 'image/tiff'
  }
  if (startsWith(0, 0, 1, 0) || startsWith(0, 0, 2, 0)) {
    return 'image/x-icon'
  }
  if (header.slice(4, 8) === 'ftyp') {
    const brand = header.slice(8, 12)
    if (brand === 'avif' || brand === 'avis') {
      return 'image/avif'
    }
    if (brand === 'heic' || brand === 'heix') {
      return 'image/heic'
    }
  }
  return ''
}

/** 非图片附件可直接打开的类型：PDF 与纯文本；含 NUL 的按二进制处理，返回空字符串。 */
const sniffDocumentType = (bytes: Uint8Array): string => {
  if (new TextDecoder('ascii').decode(bytes.subarray(0, 5)) === '%PDF-') {
    return 'application/pdf'
  }
  if (bytes.includes(0)) {
    return ''
  }
  try {
    // 文件头可能截断在多字节字符中间，按流式解码只检查已有部分。
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true })
    return 'text/plain;charset=utf-8'
  } catch {
    // 其他编码交给浏览器识别；text/plain 不会被当作 HTML 解析。
    return 'text/plain'
  }
}

/** 以指定类型重新包装原件，丢弃原件自带的 MIME。 */
const createUrl = (blob: Blob, type: string) => URL.createObjectURL(new Blob([blob], { type }))

/**
 * 按内容判定原件能否直接查看：图片只认位图，非图片只认 PDF 与纯文本
 * （HTML、XML 等标记文件按纯文本显示源码）。能查看时返回按该类型包装的 blob: 地址，
 * 由调用方释放；SVG、无法识别的图片和二进制文件返回 null。
 */
export const createViewUrl = async (blob: Blob, isImage: boolean): Promise<string | null> => {
  const sample = new Uint8Array(await blob.slice(0, SAMPLE_BYTES).arrayBuffer())
  const type = isImage ? sniffImageType(sample) : sniffDocumentType(sample)
  return type ? createUrl(blob, type) : null
}

/** 以 application/octet-stream 下载原件，浏览器不会把它当作文档渲染。 */
export const downloadFile = (blob: Blob, name: string) => {
  const url = createUrl(blob, 'application/octet-stream')
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_TTL_MS)
}
