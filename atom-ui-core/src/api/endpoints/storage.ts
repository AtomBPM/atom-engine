import { apiClient, extractData } from '../client'
import { StorageStatus, StorageInfo } from '../../types/api'

// GET /api/v1/storage/status
export const getStorageStatus = async (): Promise<StorageStatus> => {
  const response = await apiClient.get('/api/v1/storage/status')
  return extractData(response)
}

// GET /api/v1/storage/info
export const getStorageInfo = async (): Promise<StorageInfo> => {
  const response = await apiClient.get('/api/v1/storage/info')
  return extractData(response)
}
