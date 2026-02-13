import { apiClient, extractData } from '../client'
import { ExpressionResult, ExpressionFunction } from '../../types/api'

// POST /api/v1/expressions/evaluate
export const evaluateExpression = async (data: {
  expression: string
  variables?: Record<string, any>
}): Promise<ExpressionResult> => {
  const response = await apiClient.post('/api/v1/expressions/evaluate', data)
  return extractData(response)
}

// POST /api/v1/expressions/evaluate/batch
export const evaluateBatch = async (data: {
  expressions: Array<{ expression: string; variables?: Record<string, any> }>
}): Promise<ExpressionResult[]> => {
  const response = await apiClient.post('/api/v1/expressions/evaluate/batch', data)
  return extractData(response)
}

// POST /api/v1/expressions/evaluate/condition
export const evaluateCondition = async (data: {
  condition: string
  variables?: Record<string, any>
}): Promise<ExpressionResult> => {
  const response = await apiClient.post('/api/v1/expressions/evaluate/condition', data)
  return extractData(response)
}

// POST /api/v1/expressions/parse
export const parseExpression = async (data: {
  expression: string
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/expressions/parse', data)
  return extractData(response)
}

// POST /api/v1/expressions/validate
export const validateExpression = async (data: {
  expression: string
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/expressions/validate', data)
  return extractData(response)
}

// POST /api/v1/expressions/test
export const testExpression = async (data: {
  expression: string
  variables?: Record<string, any>
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/expressions/test', data)
  return extractData(response)
}

// POST /api/v1/expressions/extract-variables
export const extractVariables = async (data: {
  expression: string
}): Promise<string[]> => {
  const response = await apiClient.post('/api/v1/expressions/extract-variables', data)
  return extractData(response)
}

// GET /api/v1/expressions/functions
export const getSupportedFunctions = async (): Promise<ExpressionFunction[]> => {
  const response = await apiClient.get('/api/v1/expressions/functions')
  return extractData(response)
}
