import { useState, useEffect, useCallback, useRef } from 'react'
import { message } from 'antd'

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: any) => void
  immediate?: boolean
}

export function useApi<T>(
  apiFunc: (...args: any[]) => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const optionsRef = useRef(options)
  
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const execute = useCallback(async (...args: any[]) => {
    setLoading(true)
    setError(null)

    try {
      const result = await apiFunc(...args)
      setData(result)
      optionsRef.current.onSuccess?.(result)
      return result
    } catch (err: any) {
      setError(err)
      optionsRef.current.onError?.(err)
      
      // Error message already shown by API client interceptor
      // Only log to console for debugging
      console.error('API Error:', err)
      
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiFunc])

  useEffect(() => {
    if (options.immediate) {
      execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refetch = useCallback(() => {
    return execute()
  }, [execute])

  return {
    data,
    loading,
    error,
    execute,
    refetch,
  }
}

// Hook for mutations (POST, PUT, DELETE)
export function useMutation<T, Args extends any[] = any[]>(
  apiFunc: (...args: Args) => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const mutate = useCallback(async (...args: Args): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await apiFunc(...args)
      options.onSuccess?.(result)
      return result
    } catch (err: any) {
      setError(err)
      options.onError?.(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [apiFunc, options])

  return {
    mutate,
    loading,
    error,
  }
}
