import { defineStore } from 'pinia'
import type { UseUploadTaskReturn } from '@/types/upload'
import { UseUploadManager } from '@/composables/upload/useUploadManager'

export const useUploadStore = defineStore('upload', () => {
  // 创建全局唯一的上传管理器（每次调用 store 都会返回同一个实例）
  const manager = UseUploadManager({ maxConcurrentTasks: 3 })
  // 暴露响应式状态
  const tasks = manager.tasks
  const activeCount = manager.activeCount

  // 暴露操作方法（直接代理 manager 的方法）
  function addFiles(files: FileList) {
    manager.addFiles(files)
  }
  function tryStartNext() {
    manager.tryStartNext()
  }
  function pauseTask(task: UseUploadTaskReturn) {
    manager.pauseTask(task)
  }

  function resumeTask(task: UseUploadTaskReturn) {
    manager.resumeTask(task)
  }

  function cancelTask(task: UseUploadTaskReturn) {
    manager.cancelTask(task)
  }

  function retryTask(task: UseUploadTaskReturn) {
    manager.retryTask(task)
  }

  return {
    tasks,
    activeCount,
    tryStartNext,
    addFiles,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
  }
})
