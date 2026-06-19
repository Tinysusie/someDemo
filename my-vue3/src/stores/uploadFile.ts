import { defineStore } from 'pinia'
import type { uploadFile } from './type'

const uploadFiles: uploadFile[] = []

export const useUploadFileStore = defineStore('uploadFile', () => {
  return {
    uploadFiles,
  }
})
