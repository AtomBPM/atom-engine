import { apiClient, extractData } from '../client'
import { Job, JobStats, PaginatedResponse } from '../../types/api'

// POST /api/v1/jobs
export const createJob = async (data: {
  type: string
  process_instance_id: string
  element_id: string
  element_instance_id?: string
  custom_headers?: Record<string, string>
  variables?: Record<string, any>
  retries?: number
  timeout_ms?: number
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/jobs', data)
  return extractData(response)
}

// GET /api/v1/jobs
export const listJobs = async (params?: {
  page?: number
  limit?: number
  type?: string
  worker?: string
  state?: string
}): Promise<PaginatedResponse<Job[]>> => {
  const response = await apiClient.get('/api/v1/jobs', { params })
  return response.data
}

// GET /api/v1/jobs/:key
export const getJob = async (key: string): Promise<Job> => {
  const response = await apiClient.get(`/api/v1/jobs/${key}`)
  return extractData(response)
}

// POST /api/v1/jobs/activate
export const activateJobs = async (data: {
  type: string
  worker: string
  max_jobs?: number
  timeout_ms?: number
}): Promise<{ jobs: Job[] }> => {
  const response = await apiClient.post('/api/v1/jobs/activate', data)
  return extractData(response)
}

// PUT /api/v1/jobs/:key/complete
export const completeJob = async (key: string, variables?: Record<string, any>): Promise<any> => {
  const response = await apiClient.put(`/api/v1/jobs/${key}/complete`, { variables })
  return extractData(response)
}

// PUT /api/v1/jobs/:key/fail
export const failJob = async (key: string, data: {
  retries: number
  error_message?: string
  backoff_ms?: number
}): Promise<any> => {
  const response = await apiClient.put(`/api/v1/jobs/${key}/fail`, data)
  return extractData(response)
}

// POST /api/v1/jobs/:key/throw-error
export const throwJobError = async (key: string, data: {
  error_code: string
  error_message?: string
  variables?: Record<string, any>
}): Promise<any> => {
  const response = await apiClient.post(`/api/v1/jobs/${key}/throw-error`, data)
  return extractData(response)
}

// PUT /api/v1/jobs/:key/retries
export const updateJobRetries = async (key: string, retries: number): Promise<any> => {
  const response = await apiClient.put(`/api/v1/jobs/${key}/retries`, { retries })
  return extractData(response)
}

// DELETE /api/v1/jobs/:key
export const cancelJob = async (key: string, reason?: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/jobs/${key}`, {
    data: { reason }
  })
  return extractData(response)
}

// PUT /api/v1/jobs/:key/timeout
export const updateJobTimeout = async (key: string, timeout_ms: number): Promise<any> => {
  const response = await apiClient.put(`/api/v1/jobs/${key}/timeout`, { timeout_ms })
  return extractData(response)
}

// GET /api/v1/jobs/stats
export const getJobStats = async (): Promise<JobStats> => {
  const response = await apiClient.get('/api/v1/jobs/stats')
  return extractData(response)
}
