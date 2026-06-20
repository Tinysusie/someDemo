import { reactive, ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { uploadChunk, mergeUpload, cancelUpload, verify } from '@/api/chunkUploader'
import { computeFileHash } from '@/utils/fileHasher.ts'
import { type UploadTask, type UseUploadTaskReturn } from '@/types/upload.ts'
interface infoParams {
  type: 'error' | 'done' | 'cancelled'
  msg: string
}
export function UseUploadTask(
  file: File,
  option?: {
    chunkSize?: number
    maxCocurrent?: number
    maxRetries?: number
    onComplete?: (err: Error | null, task: UploadTask) => void
  },
): UseUploadTaskReturn {
  let pendingChunks: number[] = [] //未上传的分片索引
  let activeRequests = 0 //当前上传活跃数
  let isMerging: boolean = false //防重复merging锁
  let isPaused = false

  const chunkSize = option?.chunkSize || 0.1 * 1024 * 1024
  const maxCocurrent = option?.maxCocurrent || 3
  const maxRetries = option?.maxRetries || 3
  const onComplete = option?.onComplete || null

  const task = reactive<UploadTask>({
    // 赋唯一性，目前用文件名name＋文件大小size+最后修改时间lastModified
    id: file.name + '_' + file.size + '_' + file.lastModified,
    fileName: file.name,
    file: file,
    fileHash: '', // 上传前计算的文件哈希值
    status: 'waiting' as const,
    totalChunks: Math.ceil(file.size / chunkSize),
    progress: 0, // 0-100
    isCompleted: false,
    uploadedChunks: [] as number[],
    error: null,
    abortController: null,
    // _resolve: null as ((value: void) => void) | null,
    // _reject: null as ((value: void) => void) | null,
  })

  // 初始化task 计算hash 查询已上传切片，现在状态；开始任务
  // 暂停后恢复
  async function start() {
    console.log(`[start] 开始，当前状态: ${task.status}`)
    try {
      if (!task.fileHash) task.fileHash = await computeFileHash(file)

      await verifyUploadAndInitChunk() // 会设置 pendingChunks 和 uploadedChunks
      if (task.isCompleted) {
        // 秒传完成，直接 resolve
        if (onComplete) onComplete(null, task)
        return
      }
      task.status = 'uploading'
      isPaused = false
      task.error = ''
      isMerging = false

      // 重新获取已上传分片，防止在暂停期间有分片上传成功
      task.abortController = new AbortController()

      schedule()
    } catch (error) {
      console.log('verifyUploadAndInitChunk返回错误')
      task.status = 'error'
      if (onComplete) onComplete(new Error(`初始化检测出错`), task)
    }
  }

  function caseComplete(info: infoParams) {
    task.status = info.type
    // if (info.type === 'error') {
    //   task.status = 'error' //会中止继续上传
    //   if (onComplete) onComplete(new Error(`${info.msg}+ 上传失败`), task)
    // }
  }
  //启动并发调度
  function schedule() {
    if (task.status !== 'uploading') return
    if (task.isCompleted) return

    while (activeRequests < maxCocurrent && pendingChunks.length > 0 && !isPaused) {
      const chunkIdx = pendingChunks.shift()!

      activeRequests++
      //执行上传分片
      uploadOneChunk(chunkIdx)
        .catch((error) => {
          // 分片最终失败，标记任务错误并 reject
          task.status = 'error' //会中止继续上传
          ElMessage.error(`分片${task.fileName}, ${chunkIdx} 上传失败`)
          if (onComplete) onComplete(new Error(`分片${task.fileName}, ${chunkIdx} 上传失败`), task)
        })
        .finally(() => {
          activeRequests--
          schedule()
        })
    }
    // 检测已全部传完
    if (
      pendingChunks.length === 0 &&
      activeRequests === 0 &&
      task.uploadedChunks.length >= task.totalChunks
    ) {
      merge()
    }
  }

  //暂停上传
  function pause() {
    if (task.status !== 'uploading') return
    isPaused = true
    task.status = 'paused'
    if (task.abortController) {
      task.abortController.abort()
      task.abortController = null
    }
  }

  //继续上传
  function resume() {
    if (task.status !== 'paused') return
    task.status = 'waiting'
    start()
  }
  //错误重试
  function retry() {
    if (task.status !== 'error') return
    task.status = 'waiting'
    task.error = null
    start()
  }
  //取消上传
  async function cancel() {
    // 1. 取消正在进行的请求
    if (task.abortController) {
      task.abortController.abort()
      task.abortController = null
    }
    if (task.fileHash) {
      //存在hash，说明开始过的任务，需调用后端接口取消，否则不要
      const cancelParams = {
        fileHash: task.fileHash,
      }
      try {
        await cancelUpload(cancelParams)
      } catch (error) {
        console.warn('后端清理失败，可能分片已删除或网络问题', error)
      }
      // finally {
      //   // if (task.status === 'uploading') {
      //   //   //如果是占用槽位的任务，即uploading中的，则需要释放槽位
      //   //   if (onComplete) onComplete(new Error('已取消上传'), task)
      //   // }
      // }
    }
    //. 标记状态为取消（终态）
    task.status = 'cancelled'
    if (onComplete) onComplete(new Error('已取消上传'), task)
  }
  // 上传分片
  async function uploadOneChunk(chunkIdx: number) {
    const chunk = task.file.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize)
    const uploadParams = {
      fileHash: task.fileHash,
      chunkIndex: chunkIdx,
      totalChunks: task.totalChunks,
      chunk: chunk,
      signal: task.abortController ? task.abortController.signal : undefined,
    }

    let retries = 0 //重试次数
    while (retries < maxRetries) {
      try {
        await uploadChunk(uploadParams)
        //去重（不知道啥情况会发生重复）
        if (!task.uploadedChunks.includes(chunkIdx)) {
          task.uploadedChunks.push(chunkIdx)
          task.progress = Math.min(
            100,
            Math.floor((task.uploadedChunks.length / task.totalChunks) * 100),
          )
        } else {
          console.warn(`分片 ${task.fileName + chunkIdx} 已存在，跳过重复记录`)
        }

        return //???【while中的成功退出】
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log('error--用户取消,静默退出')
          // 1. 静默处理：不报错，不重试
          // 2. 如果有 loading 状态，这里只负责清理状态
          return
        } else {
          retries++
          console.log(error)
          if (retries >= maxRetries) {
            throw new Error(`分片${task.fileName}, ${chunkIdx} 上传失败`) //??? 外层捕捉？代码中断影响
          }
          //等待一段时间后重试???
          //???【请注意】此处由于while循环处于async异步函数内，会等await后的异步结果完成才会执行下一步，起到中断执行的作用
          await new Promise((r) => setTimeout(r, 1000 * retries))
        }
      }
    }
  }
  //合并
  async function merge() {
    if (isMerging) return
    isMerging = true
    try {
      const mergeParams = {
        fileHash: task.fileHash,
        totalChunks: task.totalChunks,
        fileName: task.fileName,
      }
      await mergeUpload(mergeParams)
      console.log('+++++++change status to done')
      task.isCompleted = true //?
      task.status = 'done'
      task.progress = 100
      ElMessage.success(`${task.fileName}上传成功`)
      if (onComplete) onComplete(null, task) //触发回调成功✅
      isMerging = false
    } catch (error) {
      task.status = 'error'
      ElMessage.error(`${task.fileName}合并失败`)
      if (onComplete) onComplete(new Error('合并失败'), task) //触发错误回调❎
      isMerging = false
    }
  }
  //验证已上传的分片 //??错误导致的中断也要捕捉影响任务状态
  async function verifyUploadAndInitChunk() {
    try {
      const verifyParams = {
        fileHash: task.fileHash,
        totalChunks: task.totalChunks,
      }
      const verifyRes: any = await verify(verifyParams)
      console.log(verifyRes)
      if (verifyRes.complete) {
        //已经存在完整文件
        console.info(`${task.fileName}` + '文件已存在！')
        task.progress = 100
        task.status = 'done'
        task.isCompleted = true
        //?? 是否需要处理其他task数据？
      } else {
        const uploadedChunks = verifyRes.uploadedChunks
        task.uploadedChunks = uploadedChunks || []
        const totalChunksList = Array.from({ length: task.totalChunks }, (_, i) => i)
        pendingChunks = totalChunksList.filter((i) => !uploadedChunks.includes(i))
        task.progress = Math.floor((uploadedChunks.length / task.totalChunks) * 100)
      }
    } catch (error) {
      task.status = 'error'
      task.error = '检测分片信息失败'
      ElMessage.error(`${task.fileName}检测分片`)
      if (onComplete) onComplete(new Error('检测分片'), task) //触发错误回调❎
      throw error
    }
  }
  return {
    task,
    start,
    pause,
    resume,
    cancel,
    retry,
  }
}
