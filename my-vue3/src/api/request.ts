import axios from 'axios'
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import type { ApiResponse } from './types'

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  //|| '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 在这里可以添加token或其他认证信息
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 假设后端返回的数据格式为 { code: 200, data: ..., message: '...' }
    const { data } = response
    if (data.code === 200) {
      // 返回修改后的response，data为ApiResponse
      return { ...response, data }
    } else {
      // 处理业务错误
      console.error('API Error:', data.message)
      return Promise.reject(new Error(data.message || '请求失败'))
    }
  },
  (error) => {
    // 处理HTTP错误
    if (error.response) {
      const { status } = error.response
      switch (status) {
        case 401:
          // 未授权，跳转到登录页
          console.error('未授权')
          break
        case 403:
          console.error('拒绝访问')
          break
        case 404:
          console.error('请求地址不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(`HTTP错误: ${status}`)
      }
    } else if (axios.isCancel(error)) {
      console.log('请求已被取消', error.message)
      throw error
      //此处不当异常处理
    } else if (error.request) {
      console.error('网络错误')
    } else {
      console.error('请求配置错误', error)
    }
    return Promise.reject(error)
  },
)

// 封装请求方法
export const get = <T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
  return request.get(url, config).then((res) => res.data)
}

export const post = <T = unknown>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
  return request.post(url, data, config).then((res) => res.data)
}

export const put = <T = unknown>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
  return request.put(url, data, config).then((res) => res.data)
}

export const del = <T = unknown>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
  return request.delete(url, { ...config, data }).then((res) => res.data)
}

export default request
