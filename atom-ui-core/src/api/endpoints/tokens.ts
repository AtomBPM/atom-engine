import { apiClient, extractData } from '../client'
import { Token, PaginatedResponse } from '../../types/api'

export interface ListTokensParams {
  instance_id?: string
  state?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: string
}

// GET /api/v1/tokens
export const listTokens = async (params?: ListTokensParams): Promise<PaginatedResponse<Token[]>> => {
  const response = await apiClient.get('/api/v1/tokens', { params })
  return extractData(response)
}

// GET /api/v1/tokens/:id
export const getTokenStatus = async (id: string): Promise<Token> => {
  const response = await apiClient.get(`/api/v1/tokens/${id}`)
  return extractData(response)
}
