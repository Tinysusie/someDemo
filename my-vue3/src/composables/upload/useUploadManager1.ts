import { ref, reactive, watch } from 'vue'
import { useUploadTask } from './useUploadTask'

// useUploadManager.ts 核心伪代码
const tasks = ref<TaskInstance[]>([])
const activeCount = ref(0)
const waitingQueue: TaskInstance[] = []

function addTask(task: TaskInstance) {
  tasks.value.push(task)
  // 监听该任务的状态变化
  watch(
    () => task.status.value,
    (newStatus, oldStatus) => {
      // 关键：当任务变成终态（done/error）时，回收槽位
      if (newStatus === 'done' || newStatus === 'error') {
        activeCount.value--
        // 从活跃列表移除（如果有）
        // 启动等待队列中的下一个任务
        tryStartNext()
      }
    },
  )
  // 尝试加入队列启动
  waitingQueue.push(task)
  tryStartNext()
}

function tryStartNext() {
  while (activeCount.value < MAX && waitingQueue.length > 0) {
    const task = waitingQueue.shift()!
    // 只启动未完成的任务
    if (task.status.value === 'idle' || task.status.value === 'paused') {
      activeCount.value++
      task.start() // 内部将状态改为 'uploading'
    }
  }
}

// 暂停接口
function pauseTask(task: TaskInstance) {
  if (task.status.value !== 'uploading') return
  task.pause() // 内部状态变为 'paused'
  activeCount.value-- // 释放槽位
  // 如果它在等待队列里（理论上不在），移除它
  // 然后尝试启动下一个
  tryStartNext()
}

// 恢复接口
function resumeTask(task: TaskInstance) {
  if (task.status.value !== 'paused') return
  // 重新放入等待队列，并尝试启动
  // 注意：不要在这里 activeCount++，让 tryStartNext 去做
  const exists = waitingQueue.some((t) => t.id === task.id)
  if (!exists) waitingQueue.push(task)
  tryStartNext()
}

export function useUploadManager(options: {
  maxConcurrentFiles: number
  chunkSize: number
  maxConcurrentChunks: number
  maxRetries: number
}) {
  const tasks = ref<any[]>([]) // 存储任务实例
  const activeCount = ref(0)
  const waitingQueue = ref<any[]>([])

  function addFiles(files: File[]) {
    for (const file of files) {
      const task = useUploadTask(file, {
        chunkSize: options.chunkSize,
        maxConcurrentChunks: options.maxConcurrentChunks,
        maxRetries: options.maxRetries,
      })
      tasks.value.push(task)
      // 初始化后判断是否立即启动
      task.init().then(() => {
        if (activeCount.value < options.maxConcurrentFiles) {
          startTask(task)
        } else {
          task.task.status = 'waiting'
          waitingQueue.value.push(task)
        }
      })
    }
  }

  async function startTask(task: any) {
    if (task.task.status === 'done' || task.task.status === 'uploading') return
    activeCount.value++
    task.task.status = 'uploading'
    await task.start()
    // 监听任务结束（done或error）
    const checkInterval = setInterval(() => {
      if (task.task.status === 'done' || task.task.status === 'error') {
        clearInterval(checkInterval)
        activeCount.value--
        // 从等待队列中取出下一个
        if (waitingQueue.value.length > 0) {
          const next = waitingQueue.value.shift()
          startTask(next)
        }
      }
    }, 500)
  }

  function pauseTask(task: any) {
    task.pause()
  }

  function resumeTask(task: any) {
    if (task.task.status === 'paused') {
      if (activeCount.value < options.maxConcurrentFiles) {
        startTask(task)
      } else {
        // 放回等待队列前端
        waitingQueue.value.unshift(task)
        task.task.status = 'waiting'
      }
    }
  }

  function cancelTask(task: any) {
    task.cancel()
    const index = tasks.value.findIndex((t) => t === task)
    if (index !== -1) tasks.value.splice(index, 1)
    // 从等待队列移除
    const waitIndex = waitingQueue.value.findIndex((t) => t === task)
    if (waitIndex !== -1) waitingQueue.value.splice(waitIndex, 1)
    if (task.task.status === 'uploading') activeCount.value--
  }

  return {
    tasks,
    activeCount,
    addFiles,
    pauseTask,
    resumeTask,
    cancelTask,
  }
}
