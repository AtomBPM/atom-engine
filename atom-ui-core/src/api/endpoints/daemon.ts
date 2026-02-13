import { apiClient, extractData } from '../client'

export interface DaemonStatus {
  status: string
  health: string
  uptime: number
  version: string
  components: number
}

export interface DaemonEvent {
  id: string
  type: string
  status: string
  message: string
  timestamp: string
  created_at: number
}

export interface DaemonEventsResponse {
  events: DaemonEvent[]
  total_count: number
  limit: number
}

// GET /api/v1/daemon/status
export const getDaemonStatus = async (): Promise<DaemonStatus> => {
  const response = await apiClient.get('/api/v1/daemon/status')
  return extractData(response)
}

// POST /api/v1/daemon/start
export const startDaemon = async (): Promise<any> => {
  const response = await apiClient.post('/api/v1/daemon/start')
  return extractData(response)
}

// POST /api/v1/daemon/stop
export const stopDaemon = async (): Promise<any> => {
  const response = await apiClient.post('/api/v1/daemon/stop')
  return extractData(response)
}

// GET /api/v1/daemon/events
export const getDaemonEvents = async (limit?: number): Promise<DaemonEventsResponse> => {
  const response = await apiClient.get('/api/v1/daemon/events', {
    params: { limit: limit || 50 }
  })
  return extractData(response)
}
