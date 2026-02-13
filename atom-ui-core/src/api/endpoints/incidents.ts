import { apiClient, extractData } from '../client'
import { Incident, IncidentStats, PaginatedResponse } from '../../types/api'

// POST /api/v1/incidents
export const createIncident = async (data: {
  type: string
  message: string
  process_instance_id: string
  job_key?: string
  element_id: string
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/incidents', data)
  return extractData(response)
}

// GET /api/v1/incidents
export const listIncidents = async (params?: {
  page?: number
  limit?: number
  state?: string
  type?: string
}): Promise<PaginatedResponse<Incident[]>> => {
  const response = await apiClient.get('/api/v1/incidents', { params })
  return response.data
}

// GET /api/v1/incidents/:id
export const getIncident = async (id: string): Promise<Incident> => {
  const response = await apiClient.get(`/api/v1/incidents/${id}`)
  return extractData(response)
}

// PUT /api/v1/incidents/:id/resolve
export const resolveIncident = async (id: string, data?: {
  resolution?: string
}): Promise<any> => {
  const response = await apiClient.put(`/api/v1/incidents/${id}/resolve`, data)
  return extractData(response)
}

// GET /api/v1/incidents/stats
export const getIncidentStats = async (): Promise<IncidentStats> => {
  const response = await apiClient.get('/api/v1/incidents/stats')
  return extractData(response)
}
