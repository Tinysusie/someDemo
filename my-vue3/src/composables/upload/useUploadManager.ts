import { ref, reactive, watch, onActivated } from 'vue'
import { UseUploadTask } from './useUploadTask'
import { type UploadTask, type UseUploadTaskReturn } from '@/types/upload.ts'
import { ElMessage } from 'element-plus'
//【完美体现了“关注点分离”和“响应式驱动”的思想🎉】
//【关注点分离】，manager和task尽量解耦，槽位管理是manager的职责，
// 利用promise承诺和事件回调都不能很好的解决槽位占用和释放问题，需要增加一些额外标识判断，代码趋于冗余
// 最终尝试watch监听完成状态，结合任务所处状态来管理槽位
export function UseUploadManager(option?: { maxConcurrentTasks: number }) {
  const fileMap = new Map<string, UseUploadTaskReturn>()
  const tasks = ref<UseUploadTaskReturn[]>([])
  const activeCount = ref<number>(0)
  const activeTaskSet = new Set() // 【记录当前真正占用槽位的任务】
  // const activeTaskSet = ref<Set>(new Set()) // 【记录当前真正占用槽位的任务】
  const waitingTaskQueue: UseUploadTaskReturn[] = []
  const maxConcurrentTasks = option?.maxConcurrentTasks || 3

  // // 基础类型联合
  // const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

  function addFiles(files: FileList) {
    for (const file of files) {
      const uploadTask = UseUploadTask(file, {
        // onComplete: (err: Error | null, task: UploadTask) => {
        //   if (!err) {
        //     console.log('任务完成', task.fileName)
        //   } else {
        //     console.log('任务失败', task.fileName)
        //   }
        //   // if (activeTaskSet.has(uploadTask)) {
        //   //   activeTaskSet.delete(uploadTask)
        //   //   activeCount.value--
        //   //   tryStartNext()
        //   // }
        // },
      })
      const id = uploadTask.task.id
      if (!fileMap.has(id)) {
        fileMap.set(id, uploadTask)
        tasks.value.push(uploadTask)
        waitingTaskQueue.push(uploadTask)
      }
      // watch返回的是一个stop函数，调用可停止监听，防止内存泄漏
      const _stopWatch = watch(
        () => uploadTask.task.status,
        (newStatus, oldStatus) => {
          console.log(`[Watch] ${uploadTask.task.id} 状态变化: ${oldStatus} -> ${newStatus}`)
          if (['done', 'paused', 'error', 'cancelled'].includes(newStatus)) {
            // 🔥 标记：如果这个任务正在占用槽位，释放它
            console.log(
              'activeTaskSet----------->',
              activeTaskSet,
              activeTaskSet.has(uploadTask.task.id),
            )
            if (activeTaskSet.has(uploadTask.task.id)) {
              activeTaskSet.delete(uploadTask.task.id) //暂停的时候不可以删除uploadTask
              console.log('------------- activeCount--', newStatus, uploadTask.task.fileName)
              activeCount.value--
              tryStartNext()
              //移除列表了，不需要监听了
              if (newStatus === 'done' || newStatus === 'cancelled') {
                console.log('xxxxxxxxxx ', 'stopwatch', uploadTask.task.fileName)
                _stopWatch() // 任务终态后不再需要监听
              }
            }
            // 无论是否占用槽位，完成态的task如果在等待队列中，移除它（兜底）
            const idx = waitingTaskQueue.findIndex((t) => t.task.id === uploadTask.task.id)
            if (idx !== -1) waitingTaskQueue.splice(idx, 1)
          }
        },
      )
    }
    // tryStartNext()
  }

  function tryStartNext() {
    while (activeCount.value < maxConcurrentTasks && waitingTaskQueue.length > 0) {
      const uploadTask = waitingTaskQueue.shift()!
      if (
        uploadTask.task.status === 'done' ||
        uploadTask.task.status === 'error' ||
        uploadTask.task.status === 'cancelled'
      )
        continue

      // 真正paused的task不会出现在waitingTaskQueue里，除非需要重启的但是状态仍为paused的task
      // paused： （分为用户暂停不让继续的（已被移除队列） | 用户继续但还在排队的的需要resume的【继续上传】）
      // waitting： 还未开始的【开始上传】
      // uploading: 正在上传的，正常也不会出现在等待列表中，但以防边界情况此处可以处理为【继续上传】

      // 🔥 标记：这个任务现在占用槽位
      console.log('>>>>> activeTaskSet >>> activeCount++')
      activeTaskSet.add(uploadTask.task.id)

      console.log('activeTaskSet+++++++++>', activeTaskSet)
      activeCount.value++
      uploadTask.start()
    }
  }

  function pauseTask(uploadTask: UseUploadTaskReturn) {
    uploadTask.pause()
    // 从等待队列移除（它本不该在队列中，但以防万一）watch里会处理移除
    // const idx = waitingTaskQueue.findIndex(
    //   (waittingTask) => waittingTask.task.id === uploadTask.task.id,
    // )
    // if (idx !== -1) waitingTaskQueue.splice(idx, 1)
  }
  function resumeTask(uploadTask: UseUploadTaskReturn) {
    if (uploadTask.task.status !== 'paused') return
    //放入队列，让调度器处理
    console.log('=-=-=-=-=-=-=[resumeTask] ')
    enqueueTask(uploadTask)
  }
  function retryTask(uploadTask: UseUploadTaskReturn) {
    if (uploadTask.task.status !== 'error') return
    //放入队列，让调度器处理
    enqueueTask(uploadTask)
  }
  //重新入队
  function enqueueTask(uploadTask: UseUploadTaskReturn) {
    //放入队列，让调度器处理
    const exists = waitingTaskQueue.some(
      (waitingTask) => waitingTask.task.id === uploadTask.task.id,
    )
    uploadTask.task.status = 'waiting' //变更状态为waiting

    console.log('=-=-=-=-=-=-=[] 状态已设为 waiting，即将调用 start')
    if (!exists) waitingTaskQueue.push(uploadTask)
    tryStartNext()
  }
  function cancelTask(uploadTask: UseUploadTaskReturn) {
    uploadTask.cancel()
    // . 从等待队列中移除（如果存在）watch会移除waitingTaskQueue里的
    // const idx = waitingTaskQueue.findIndex(
    //   (waitingTask) => waitingTask.task.id === uploadTask.task.id,
    // )
    // if (idx !== -1) waitingTaskQueue.splice(idx, 1)

    // . 从任务列表中移除（可选，也可保留为cancelled状态供UI显示）
    // 这里选择移除以保持列表简洁（如果UI需要显示历史，则保留）
    const listIdx = tasks.value.findIndex((t) => t.task.id === uploadTask.task.id)
    if (listIdx !== -1) {
      tasks.value.splice(listIdx, 1)
    }
    //其他移除
    fileMap.delete(uploadTask.task.id)
  }
  return {
    activeCount,
    tasks,
    addFiles,
    tryStartNext,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
  }
}
