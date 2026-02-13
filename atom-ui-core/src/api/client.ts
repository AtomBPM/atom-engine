import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useServerStore } from '../store/serverStore'
import { APIResponse, APIError } from '../types/api'

// Create axios instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor - add auth and server URL
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const server = useServerStore.getState().getCurrentServer()
      
      if (!server) {
        message.error('No server configured')
        return Promise.reject(new Error('No server configured'))
      }

      // Set base URL from current server (empty for proxy)
      if (server.url) {
        config.baseURL = server.url
      }

      // Add API key to headers
      config.headers['X-API-Key'] = server.apiKey

      // Add request ID
      config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor - handle errors
  client.interceptors.response.use(
    (response) => {
      // Check if response has error in data
      const data = response.data as APIResponse
      
      if (data && !data.success && data.error) {
        const error = new Error(data.error.message) as any
        error.response = response
        error.apiError = data.error
        return Promise.reject(error)
      }

      return response
    },
    (error: AxiosError) => {
      // Handle network errors
      if (!error.response) {
        message.error('Network error: Unable to connect to server')
        return Promise.reject(error)
      }

      const response = error.response.data as APIResponse | undefined
      const apiError: APIError = response?.error || {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        details: null
      }

      // Handle specific HTTP status codes
      switch (error.response.status) {
        case 400:
          message.error(`Bad Request: ${apiError.message}`)
          break
        case 401:
          message.error('Unauthorized: Invalid API key')
          break
        case 403:
          message.error('Forbidden: Insufficient permissions')
          break
        case 404:
          message.error('Not Found: Resource does not exist')
          break
        case 429:
          message.error('Too Many Requests: Rate limit exceeded')
          break
        case 500:
          message.error(`Server Error: ${apiError.message}`)
          break
        default:
          message.error(`Error: ${apiError.message}`)
      }

      // Attach API error to axios error
      const enrichedError = error as any
      enrichedError.apiError = apiError

      return Promise.reject(enrichedError)
    }
  )

  return client
}

// Export singleton instance
export const apiClient = createApiClient()

// Helper to extract data from API response
export const extractData = <T>(response: any): T => {
  return response.data?.data || response.data
}

// Helper to handle API errors
export const handleApiError = (error: any): APIError => {
  if (error.apiError) {
    return error.apiError
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'An unknown error occurred',
    details: null
  }
}
