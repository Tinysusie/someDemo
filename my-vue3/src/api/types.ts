// API响应基础类型
export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}

// 用户相关类型
export interface User {
  id: string
  username: string
  email: string
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}
