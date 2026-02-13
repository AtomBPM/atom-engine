import { apiClient, extractData } from '../client'
import {
  SystemStatus,
  SystemInfo,
  SystemMetrics,
  ComponentStatus,
} from '../../types/api'

// GET /api/v1/system/status
export const getSystemStatus = async (): Promise<SystemStatus> => {
  const response = await apiClient.get('/api/v1/system/status')
  return extractData(response)
}

// GET /api/v1/system/info
export const getSystemInfo = async (): Promise<SystemInfo> => {
  const response = await apiClient.get('/api/v1/system/info')
  return extractData(response)
}

// GET /api/v1/system/metrics
export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  const response = await apiClient.get('/api/v1/system/metrics')
  return extractData(response)
}

// GET /api/v1/system/health
export const getSystemHealth = async (): Promise<any> => {
  const response = await apiClient.get('/api/v1/system/health')
  return extractData(response)
}

// GET /api/v1/system/components
export const listComponents = async (): Promise<ComponentStatus[]> => {
  const response = await apiClient.get('/api/v1/system/components')
  const data = extractData(response)
  return data.components || []
}

// GET /api/v1/system/components/:name
export const getComponentStatus = async (name: string): Promise<ComponentStatus> => {
  const response = await apiClient.get(`/api/v1/system/components/${name}`)
  return extractData(response)
}

// GET /api/v1/system/components/:name/health
export const getComponentHealth = async (name: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/system/components/${name}/health`)
  return extractData(response)
}
