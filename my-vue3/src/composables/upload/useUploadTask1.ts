//单个上传任务
import { ref, reactive } from 'vue'
import { uploadChunk } from '@/api/chunkUploader'
import { computeFileHash } from '@/utils/fileHasher'
import type { UploadTask } from '@/types/upload'
import axios from 'axios'

export function UseUploadTask(
  file: File,
  options: { chunkSize: number; maxConcurrent: number; maxRetries: number },
) {
  const task = reactive<UploadTask>({
    id: crypto.randomUUID(),
    file: file,
    fileHash: '',
    progress: 0,
    status: 'waiting', //???
    totalChunks: 0,
    uploadedChunks: [] as number[],
    speed: 0,
    error: null,
    startTime: undefined as number | undefined,
    abortController: null,
  })

  let pendingChunks: number[] = [] //待上传的分片索引
  let activeRequests = 0 //当前活跃的上传请求数
  let retryMap = new Map<number, number>() //分片重试次数记录
  let isPaused = false //上传是否暂停

  function getFileHash(): string {
    if (!task.fileHash) {
      throw new Error('fileHash 未初始化')
    }
    return task.fileHash
  }

  //获取已上传的分片列表
  async function fetchUploadedChunks(fileHash: string): Promise<number[]> {
    try {
      const res = await axios.get(`/api/upload/status?fileHash=${fileHash}`)
      return res.data.uploadedChunks || []
    } catch (error) {
      console.error('获取上传状态失败', error)
      return []
    }
  }
  //初始化任务：计算hash 、分片、查询已上传分片
  async function init() {
    task.fileHash = await computeFileHash(task.file)
    task.totalChunks = Math.ceil(task.file.size / options.chunkSize)
    const uploaded = await fetchUploadedChunks(getFileHash())
    task.uploadedChunks = uploaded
    task.progress = Math.round((task.uploadedChunks.length / task.totalChunks) * 100)
    // 未上传的分片
    pendingChunks = Array.from({ length: task.totalChunks }, (_, i) => i).filter(
      (i) => !uploaded.includes(i),
    ) //???
    return pendingChunks.length === 0 // 是否已完成
  }

  // 开始上传（从队列调度）
  async function start() {
    if (task.status === 'uploading') return
    if (pendingChunks.length === 0 && task.uploadedChunks.length === task.totalChunks) {
      await merge()
      return
    }
    task.status = 'uploading'
    task.startTime = Date.now()
    task.abortController = new AbortController()
    isPaused = false
    // 启动并发上传
    schedule()
  }

  function schedule() {
    if (task.status !== 'uploading') return
    while (activeRequests < options.maxConcurrent && pendingChunks.length > 0 && !isPaused) {
      const chunkIndex = pendingChunks.shift()! ///???
      activeRequests++
      uploadOneChunk(chunkIndex).finally(() => {
        activeRequests--
        schedule() // 继续调度
      })
    }
  }
  // 所有分片都上传完成
  if (
    activeRequests === 0 &&
    pendingChunks.length === 0 &&
    task.uploadedChunks.length === task.totalChunks
  ) {
    merge()
  }

  async function uploadOneChunk(chunkIndex: number) {
    const start = chunkIndex * options.chunkSize
    const end = Math.min(start + options.chunkSize, task.file.size)
    const chunkBlob = task.file.slice(start, end)
    let retries = 0

    const attempt = async (): Promise<void> => {
      try {
        await uploadChunk({
          fileHash: getFileHash(),
          chunkIndex,
          totalChunks: task.totalChunks,
          chunk: chunkBlob,
          cancelToken: task.abortController
            ? { token: task.abortController.signal }
            : (undefined as any),
        })

        //上传成功
        task.uploadedChunks.push(chunkIndex)
        task.progress = Math.floor((task.uploadedChunks.length / task.totalChunks) * 100)
        //更新速度（可选）
      } catch (err: any) {
        if (err.message === 'canceled') {
          throw err
        }
        if (retries < options.maxRetries) {
          retries++
          await new Promise((res) => setTimeout(res, 1000 * retries)) //指数退避
          return attempt()
        } else {
          throw new Error(`分片 ${chunkIndex} 上传失败`)
        }
      }
    }

    return attempt() //??为何要return?
  }
  async function merge() {
    try {
      await axios.post('/api/upload/merge', {
        fileHash: getFileHash(),
        filename: task.file.name,
        totalChunks: task.totalChunks,
      })
      task.status = 'done'
      task.progress = 100
    } catch (error) {
      task.status = 'error'
      task.error = '合并文件失败'
    }
  }

  function pause() {
    if (task.status !== 'uploading') return
    isPaused = true
    task.status = 'paused'
    if (task.abortController) {
      task.abortController.abort()
      task.abortController = null
    }
  }

  async function resume() {
    if (task.status !== 'paused') return
    // 重新获取已上传分片，防止在暂停期间有分片上传成功
    const uploaded = await fetchUploadedChunks(getFileHash())
    task.uploadedChunks = uploaded
    pendingChunks = Array.from({ length: task.totalChunks }, (_, i) => i).filter(
      (i) => !uploaded.includes(i),
    )
    task.status = 'uploading'
    isPaused = false
    task.abortController = new AbortController()
    schedule()
  }

  async function cancel() {
    if (task.abortController) {
      task.abortController.abort()
      task.abortController = null
    }
    // 可选：通知服务器取消上传，清理已上传分片
    try {
      await axios.post('/api/upload/cancel', {
        fileHash: getFileHash(),
      })
      task.status = 'error'
      task.error = '已取消'
    } catch (error) {
      console.error('取消上传失败', error)
    }
  }

  return {
    task,
    init,
    start,
    pause,
    resume,
    cancel,
  }
}
