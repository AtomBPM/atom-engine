import { apiClient, extractData } from '../client'
import { BPMNProcess, BPMNStats, PaginatedResponse } from '../../types/api'

// POST /api/v1/bpmn/parse
export const parseBPMN = async (file: File): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await apiClient.post('/api/v1/bpmn/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return extractData(response)
}

// GET /api/v1/bpmn/processes
export const listBPMNProcesses = async (params?: {
  page?: number
  limit?: number
  key?: string
}): Promise<PaginatedResponse<BPMNProcess[]>> => {
  const response = await apiClient.get('/api/v1/bpmn/processes', { params })
  return response.data
}

// GET /api/v1/bpmn/processes/:key
export const getBPMNProcess = async (key: string): Promise<BPMNProcess> => {
  const response = await apiClient.get(`/api/v1/bpmn/processes/${key}`)
  return extractData(response)
}

// DELETE /api/v1/bpmn/processes/:id
export const deleteBPMNProcess = async (id: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/bpmn/processes/${id}`)
  return extractData(response)
}

// GET /api/v1/bpmn/processes/:key/json
export const getBPMNProcessJSON = async (key: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/bpmn/processes/${key}/json`)
  return extractData(response)
}

// GET /api/v1/bpmn/processes/:key/xml
export const getBPMNProcessXML = async (key: string): Promise<string> => {
  const response = await apiClient.get(`/api/v1/bpmn/processes/${key}/xml`)
  return extractData(response)
}

// GET /api/v1/bpmn/stats
export const getBPMNStats = async (): Promise<BPMNStats> => {
  const response = await apiClient.get('/api/v1/bpmn/stats')
  return extractData(response)
}
