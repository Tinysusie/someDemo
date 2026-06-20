<template>
  <div class="demo">
    <div>
      <p>大文件上传 {{ uploadManager.activeCount }}</p>
      <el-button v-if="uploadManager.tasks.value.length > 0" @click="startUpload()"
        >开始上传</el-button
      >
      <div class="task-list">
        <div class="task-item" v-for="task in uploadManager.tasks.value" :key="task.id">
          <el-progress
            class="task-progress"
            type="circle"
            :percentage="task.task.progress"
            :status="task.task.status === 'error' ? 'exception' : undefined"
          />
          <div class="button-group">
            <el-button v-show="task.task.status === 'uploading'" @click="pauseUpload(task)"
              >暂停</el-button
            >
            <el-button
              type="primary"
              v-show="task.task.status === 'paused'"
              @click="resumeUpload(task)"
              >继续</el-button
            >
            <el-button
              v-show="
                task.task.status !== 'done' &&
                task.task.status !== 'error' &&
                task.task.status !== 'cancelled'
              "
              type="danger"
              @click="handleCancel(task)"
              >取消</el-button
            >
            <el-button
              v-show="task.task.status === 'error'"
              type="warning"
              @click="retryUpload(task)"
              >重试</el-button
            >
          </div>

          <div class="text-block">
            <div class="task-name">{{ task.task.fileName }}</div>
            <div class="task-status">{{ task.task.status }}</div>
          </div>
        </div>
        <div class="task-item task-upload">
          <el-icon class="el-icon--upload"><Plus /></el-icon>
          <input type="file" multiple @change="handleFileSelect" />
        </div>
        <!-- <el-upload
          class="upload-card-block"
          drag
          action=""
          :auto-upload="false"
          :on-change="handleFileChange"
          multiple
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
          <template #tip>
            <div class="el-upload__tip">zip files with a size more than 500M</div>
          </template>
        </el-upload> -->
      </div>
    </div>

    <!-- <input type="file" multiple @change="handleFileSelect(0, $event)" /> -->
  </div>
</template>
<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Plus } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { UseUploadManager } from '@/composables/upload/useUploadManager'
import { type UseUploadTaskReturn } from '@/types/upload.ts'

const MAX_CONCURRENTTASKS = 3

const uploadManager = UseUploadManager({ maxConcurrentTasks: MAX_CONCURRENTTASKS })

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0 && target.files[0] instanceof File) {
    console.log(target.files)
    uploadManager.addFiles(target.files)
  }
}
function handleFileChange(file: any, fileList: any[]) {
  console.log(file, fileList)
  // if (file.raw) {
  //   uploadManager.addFiles([file.raw])
  // }
}

async function startUpload() {
  uploadManager.tryStartNext()
}

function pauseUpload(task: UseUploadTaskReturn) {
  uploadManager.pauseTask(task)
}
function handleCancel(task: UseUploadTaskReturn) {
  ElMessageBox.confirm('确认取消该文件上传？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      uploadManager.cancelTask(task)
      ElMessage.success('已取消该文件上传')
    })
    .catch(() => {})
}
function resumeUpload(task: UseUploadTaskReturn) {
  uploadManager.resumeTask(task)
}
function retryUpload(task: UseUploadTaskReturn) {
  uploadManager.retryTask(task)
}
</script>
<style>
p {
  margin-bottom: 1rem;
}
.demo {
  .task-list {
    display: grid;
    /* 每列最小宽度200px，剩余空间平均分配，自动填充行数 */
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px; /* 子项之间的间隙 */
    .task-item {
      background: #f0f0f0;
      padding: 20px;
      height: 220px;
      text-align: center;
      border-radius: 8px;
      border: 1px #f2f2f2 solid;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      &:hover .button-group {
        background-color: #ffffff7b;
        transition: all ease 0.3s;
      }
      .text-block {
        position: absolute;
        bottom: 0;
        width: 100%;
        text-align: center;
        > div {
          max-width: 100%;
          word-break: break-all;
        }
        .task-name {
          text-align: left;
          display: inline-block;
        }
      }
    }
    .button-group {
      cursor: default;
      position: absolute;
      background: transparent;
      height: 100%;
      width: 100%;
      top: 0;
      left: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      .el-button {
      }
    }
  }
  .task-upload {
    &:hover {
      border: 1px #409eff dashed;
      background-color: #bfdffe4d;
      transition: all ease 0.3s;
      color: #409eff;
    }
    > i {
      font-size: 22px;
      font-weight: bold;
    }
    input[type='file'] {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      top: 0;
      left: 0;
      cursor: pointer;
    }
  }
}
.upload-card-block {
  /* width: 300px;
  height: 200px; */
  .el-upload-list {
    /* display: flex;
    align-items: center;
    justify-content: center; */
  }
  .el-upload-list__item {
    display: inline-block;
    width: 150px;
    padding: 0.5rem;

    .el-progress {
      width: auto;
      display: inline-block;
      position: relative;
      .el-progress__text {
        top: 50%;
        transform: translateY(-50%);
      }
    }
  }
  .el-upload-list__item:hover,
  .el-upload-list__item:focus-within {
    background-color: transparent;
  }
  .el-upload-list__item:hover .el-progress__text,
  .el-upload-list__item:focus-within .el-progress__text {
    display: block;
  }
}

/* .upload-card-block :deep(.el-upload-list__item) {
  display: inline-block;
  width: 150px;
  padding: 0.5rem;
} */
.file-progress-item {
  /* display: flex;
  align-items: center;
  justify-content: center;
  width: 200px; */
  /* padding: 0.5rem; */
}
</style>
