// 分片请求封装

import type { CancelTokenSource } from 'axios'
import { post, get } from './request'
export interface ChunkUploadParams {
  fileHash: string
  chunkIndex: number
  totalChunks: number
  chunk: Blob
  onProgress?: (percent: number) => void
  signal?: AbortSignal // 新增
}
export interface MergeParams {
  fileHash: string
  fileName: string
  totalChunks: number
}
export interface VerifyParams {
  fileHash: string
  totalChunks: number
}
export interface CancelParams {
  fileHash: string
}
//检测接口
export async function verify(params: VerifyParams): Promise<unknown> {
  return post('/upload/verify', params)
}
//合并接口
export async function mergeUpload(params: MergeParams): Promise<unknown> {
  //...

  console.log('mergeUpload')
  return post('/upload/merge', params)
}
//合并接口
export async function cancelUpload(params: CancelParams): Promise<unknown> {
  //...

  console.log('cancelUpload')
  return post('/upload/cancel', params)
}
//分片接口
export async function uploadChunk(params: ChunkUploadParams): Promise<unknown> {
  try {
    const fomData = new FormData()

    fomData.append('fileHash', params.fileHash)
    fomData.append('chunkIndex', params.chunkIndex.toString())
    fomData.append('totalChunks', params.totalChunks.toString())
    fomData.append('chunk', params.chunk)

    const config: any = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }

    if (params.signal) {
      config.signal = params.signal
    }

    const res = await post('/upload/chunk', fomData, config)
    return res
  } catch (err) {
    return Promise.reject(err)
  }
}
