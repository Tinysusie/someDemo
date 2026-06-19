export interface uploadFile {
  id: string | number
  filename: string
  size: number
  totalChunks: number
  currentChunk: number
  url?: string
  thumbUrl?: string
  status?: 'uploading' | 'done' | 'error' | 'removed'
  percentage?: number
  md5?: string
  [prop: string]: string | number | boolean | undefined
}
