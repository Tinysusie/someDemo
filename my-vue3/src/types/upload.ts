export interface UploadOptions {
  chunkSize: number // 分片大小，单位字节，默认2MB
  maxConcurrentFiles: number // 最大并发上传数，默认3
  maxConcurrentChunks: number // 每个文件的最大并发分片数，默认3
  maxRetries: number // 分片上传失败后的最大重试次数，默认3
}
export interface Chunk {
  index: number
  data: Blob
}

type TaskStatus = 'waiting' | 'uploading' | 'paused' | 'done' | 'error' | 'cancelled'
export interface UploadTask {
  id: string
  fileName: string
  file: File
  fileHash: string // 可选，上传前计算的文件哈希值
  status: TaskStatus
  totalChunks: number
  progress: number // 0-100
  uploadedChunks: number[] // 已上传的分片索引列表
  isCompleted: boolean
  abortController?: AbortController | null
  [prop: string]: any // 其他自定义属性
}

export interface UseUploadTaskReturn {
  task: UploadTask
  start: () => void
  pause: () => void
  resume: () => void
  cancel: () => void
  retry: () => void
  [prop: string]: any
}
