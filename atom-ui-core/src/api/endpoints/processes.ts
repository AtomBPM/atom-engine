import { apiClient, extractData } from '../client'
import { ProcessInstance, ProcessStats, Token, PaginatedResponse } from '../../types/api'

// POST /api/v1/processes
export const startProcess = async (data: {
  process_key: string
  variables?: Record<string, any>
}): Promise<ProcessInstance> => {
  const response = await apiClient.post('/api/v1/processes', data)
  return extractData(response)
}

// GET /api/v1/processes
export const listProcesses = async (params?: {
  page?: number
  limit?: number
  status?: string
  process_key?: string
}): Promise<PaginatedResponse<ProcessInstance[]>> => {
  const response = await apiClient.get('/api/v1/processes', { params })
  return response.data
}

// GET /api/v1/processes/:id
export const getProcessStatus = async (id: string): Promise<ProcessInstance> => {
  const response = await apiClient.get(`/api/v1/processes/${id}`)
  return extractData(response)
}

// GET /api/v1/processes/:id/info
export const getProcessInfo = async (id: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/processes/${id}/info`)
  return extractData(response)
}

// DELETE /api/v1/processes/:id
export const cancelProcess = async (id: string, reason?: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/processes/${id}`, {
    data: { reason }
  })
  return extractData(response)
}

// GET /api/v1/processes/:id/tokens
export const getProcessTokens = async (id: string): Promise<PaginatedResponse<Token[]>> => {
  const response = await apiClient.get(`/api/v1/processes/${id}/tokens`)
  return response.data
}

// GET /api/v1/processes/:id/tokens/trace
export const getTokenTrace = async (id: string): Promise<PaginatedResponse<Token[]>> => {
  const response = await apiClient.get(`/api/v1/processes/${id}/tokens/trace`)
  return response.data
}

// POST /api/v1/processes/typed
export const startProcessTyped = async (data: any): Promise<any> => {
  const response = await apiClient.post('/api/v1/processes/typed', data)
  return extractData(response)
}

// GET /api/v1/processes/typed
export const listProcessesTyped = async (params?: any): Promise<any> => {
  const response = await apiClient.get('/api/v1/processes/typed', { params })
  return extractData(response)
}

// GET /api/v1/processes/:id/typed
export const getProcessStatusTyped = async (id: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/processes/${id}/typed`)
  return extractData(response)
}

// DELETE /api/v1/processes/:id/typed
export const cancelProcessTyped = async (id: string, data?: any): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/processes/${id}/typed`, { data })
  return extractData(response)
}

// GET /api/v1/processes/:id/tokens/typed
export const getProcessTokensTyped = async (id: string, params?: any): Promise<any> => {
  const response = await apiClient.get(`/api/v1/processes/${id}/tokens/typed`, { params })
  return extractData(response)
}

// GET /api/v1/processes/:id/trace/typed
export const traceProcessExecutionTyped = async (id: string, params?: any): Promise<any> => {
  const response = await apiClient.get(`/api/v1/processes/${id}/trace/typed`, { params })
  return extractData(response)
}

// GET /api/v1/processes/stats
export const getProcessStats = async (): Promise<ProcessStats> => {
  const response = await apiClient.get('/api/v1/processes/stats')
  return extractData(response)
}
