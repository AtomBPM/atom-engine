import { apiClient, extractData } from '../client'
import { Timer, TimerStats, PaginatedResponse } from '../../types/api'

// POST /api/v1/timers
export const createTimer = async (data: {
  timer_id: string
  element_id: string
  process_instance_id: string
  timer_type: string
  time_duration?: string
  time_cycle?: string
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/timers', data)
  return extractData(response)
}

// GET /api/v1/timers
export const listTimers = async (params?: {
  page?: number
  limit?: number
  status?: string
}): Promise<PaginatedResponse<Timer[]>> => {
  const response = await apiClient.get('/api/v1/timers', { params })
  return response.data
}

// GET /api/v1/timers/:id
export const getTimer = async (id: string): Promise<Timer> => {
  const response = await apiClient.get(`/api/v1/timers/${id}`)
  return extractData(response)
}

// DELETE /api/v1/timers/:id
export const deleteTimer = async (id: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/timers/${id}`)
  return extractData(response)
}

// GET /api/v1/timers/stats
export const getTimerStats = async (): Promise<TimerStats> => {
  const response = await apiClient.get('/api/v1/timers/stats')
  return extractData(response)
}
