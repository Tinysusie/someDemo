// 导出请求实例和方法 //??? 为啥要在这导出请求方法？因为我们可能会在其他地方直接使用这些方法，而不需要通过api对象调用
export { default as request, get, post, put, del } from './request'

// 导出类型
export type { ApiResponse, User, LoginParams, LoginResponse } from './types'

// 导入方法用于内部使用
import { get, post } from './request'
import type { User, LoginParams, LoginResponse } from './types'
import { uploadChunk } from './chunkUploader'

// 示例API接口
export const api = {
  // 用户相关
  user: {
    login: (data: LoginParams) => post<LoginResponse>('/user/login', data),
    getInfo: () => get<User>('/user/info'),
    logout: () => post('/user/logout'),
  },
  // 其他模块可以在这里添加
  // product: {
  //   list: (params?: any) => get('/product/list', { params }),
  //   detail: (id: string) => get(`/product/${id}`)
  // }

  hello: () => get('/hello'),
  uploadChunk: uploadChunk,
}
