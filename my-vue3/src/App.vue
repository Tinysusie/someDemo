<template>
  <header>
    <div class="logo-wrapper">
      <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />
      <p class="logo-text" v-highlight>{{ message }}</p>
    </div>

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
        <RouterLink to="/demo">Demo</RouterLink>
        <div class="upload-status">
          <el-badge :value="activeCount" :hidden="activeCount === 0" type="primary">
            <el-icon @click="drawerVisible = !drawerVisible"><Upload /></el-icon>
          </el-badge>
          <el-drawer v-model="drawerVisible" title="上传任务" size="400px">
            <div v-for="task in tasks" :key="task.task.id" class="task-item">
              <div class="task-info">
                <span>{{ task.task.fileName }}</span>
                <el-tag :type="statusTag(task.task.status)" size="small">
                  {{ task.task.status }}
                </el-tag>
              </div>
              <el-progress :percentage="task.task.progress" :status="progressStatus(task.task)" />
              <!-- <div class="task-actions">
                <el-button
                  v-if="task.task.status === 'uploading'"
                  size="small"
                  @click="pauseTask(task)"
                  >暂停</el-button
                >
                <el-button
                  v-if="task.task.status === 'paused'"
                  size="small"
                  type="primary"
                  @click="resumeTask(task)"
                  >继续</el-button
                >
                <el-button
                  v-if="task.task.status === 'error'"
                  size="small"
                  type="warning"
                  @click="retryTask(task)"
                  >重试</el-button
                >
                <el-button size="small" type="danger" @click="cancelTask(task)">取消</el-button>
              </div> -->
            </div>
          </el-drawer>
        </div>
      </nav>
    </div>
  </header>

  <RouterView />
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { api } from './api'
import { storeToRefs } from 'pinia'
import { useUploadStore } from '@/stores/uploadFile.ts'
import { Upload } from '@element-plus/icons-vue'
const message = ref('HElLO WORLD')
const uploadStore = useUploadStore()
const { tasks, activeCount, pauseTask, resumeTask, cancelTask, retryTask } =
  storeToRefs(uploadStore)
const drawerVisible = ref(false)
function statusTag(status: string) {
  const map = {
    waiting: 'info',
    uploading: 'primary',
    paused: 'warning',
    done: 'success',
    error: 'danger',
    cancelled: 'info',
  }
  return map[status as keyof typeof map] || 'info'
}
function progressStatus(task: any) {
  if (task.status === 'error' || task.status === 'cancelled') return 'exception'
  if (task.status === 'done') return 'success'
  return ''
}
api.hello().then((res) => (message.value = res.message))
</script>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
  margin-bottom: 2rem;
  .logo-text {
    text-align: center;
    font-size: 12px;
  }
}
.logo-wrapper {
  margin: 0 2rem 0 0;
}
.logo {
  display: block;
  margin: 0 auto;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
  position: relative;
  a {
    color: var(--color-text);
  }
}

nav a.router-link-exact-active {
  color: var(--color-active);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}
.upload-status {
  cursor: pointer;
  position: absolute;
  right: 0;
  bottom: 1rem;
}
.task-item {
  border-bottom: 1px solid #eee;
  padding: 12px 0;
}
.task-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.task-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    /* padding-right: calc(var(--section-gap) / 2); */
  }

  .logo {
    margin: 0 auto;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
