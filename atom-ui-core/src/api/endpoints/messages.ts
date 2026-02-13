import { apiClient, extractData } from '../client'
import { Message, MessageSubscription, MessageStats, PaginatedResponse } from '../../types/api'

// POST /api/v1/messages/publish
export const publishMessage = async (data: {
  message_name: string
  correlation_key?: string
  variables?: Record<string, any>
  ttl_seconds?: number
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/messages/publish', data)
  return extractData(response)
}

// GET /api/v1/messages
export const listBufferedMessages = async (params?: {
  page?: number
  limit?: number
}): Promise<PaginatedResponse<Message[]>> => {
  const response = await apiClient.get('/api/v1/messages', { params })
  return response.data
}

// GET /api/v1/messages/subscriptions
export const listMessageSubscriptions = async (params?: {
  page?: number
  limit?: number
}): Promise<PaginatedResponse<MessageSubscription[]>> => {
  const response = await apiClient.get('/api/v1/messages/subscriptions', { params })
  return response.data
}

// GET /api/v1/messages/stats
export const getMessageStats = async (): Promise<MessageStats> => {
  const response = await apiClient.get('/api/v1/messages/stats')
  return extractData(response)
}

// DELETE /api/v1/messages/expired
export const cleanupExpiredMessages = async (): Promise<any> => {
  const response = await apiClient.delete('/api/v1/messages/expired')
  return extractData(response)
}

// POST /api/v1/messages/test
export const testMessage = async (data: any): Promise<any> => {
  const response = await apiClient.post('/api/v1/messages/test', data)
  return extractData(response)
}
