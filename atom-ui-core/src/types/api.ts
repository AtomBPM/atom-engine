// Server configuration
export interface ServerConfig {
  id: string
  name: string
  url: string
  apiKey: string
}

// API Response wrapper
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: APIError
  request_id: string
}

export interface APIError {
  code: string
  message: string
  details?: any
}

// Pagination
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

export interface PaginatedResponse<T = any> extends APIResponse<T> {
  pagination: PaginationInfo
}

// Common response types
export interface CreateResponse {
  id: string
  message: string
}

export interface UpdateResponse {
  id?: string
  message: string
}

export interface DeleteResponse {
  id: string
  message: string
}

// Health & Status
export interface HealthResponse {
  status: string
  timestamp: string
  checks: Record<string, any>
}

// System types
export interface SystemStatus {
  status: string
  health: string
  uptime: number // in nanoseconds
  version: string
  components_total: number
  components_ready: number
  components_error: number
  started_at: string
}

export interface SystemInfo {
  name: string
  version: string
  build_time: string
  git_commit: string
  environment: string
  started_at: string
  uptime: number
  host_info: {
    hostname: string
    os: string
    architecture: string
    cpu_cores: number
    memory_total: number
    disk_total: number
  }
  configuration: {
    base_path: string
    grpc_port: number
    instance_name: string
    log_level: string
    rest_port: number
    storage_path: string
  }
}

export interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  goroutines: number
  disk_usage: number
  total_requests: number
  total_errors: number
  error_rate: number
  average_response_time: number
  requests_per_second: number
}

export interface ComponentStatus {
  name: string
  status: string
  health: string
  uptime: number
}

// Storage types
export interface StorageStatus {
  is_healthy: boolean
  status: string
  uptime_seconds: number
}

export interface StorageInfo {
  total_size_bytes: number
  used_size_bytes: number
  free_size_bytes: number
  total_keys: number
  database_path: string
  statistics: Record<string, string>
}

// BPMN types
export interface BPMNProcess {
  id: string
  key: string
  name: string
  version: number
  created_at: number
  updated_at: number
  element_count: number
  metadata?: {
    status?: string
    version_string?: string
    total_elements?: number
  }
}

export interface BPMNStats {
  total_processes: number
}

// Process types
export interface ProcessInstance {
  instance_id: string
  process_id: string
  process_name: string
  state: string
  current_activity: string
  started_at: number
  updated_at: number
  completed_at?: number
  variables: Record<string, any>
}

export interface ProcessStats {
  total_instances: number
  active_instances: number
  completed_instances: number
  cancelled_instances: number
  instances_by_status: Record<string, number>
  instances_by_process: Record<string, number>
  average_execution_time_ms: number
}

// Token types
export interface Token {
  id: string
  state: string
  element_id?: string
  current_element_id?: string
  process_instance_id: string
  process_key?: string
  waiting_for?: string
  created_at: number
  updated_at: number
  variables: Record<string, any>
}

export interface TokenStats {
  total_tokens: number
  active_tokens: number
  completed_tokens: number
  cancelled_tokens: number
  tokens_by_state: Record<string, number>
  tokens_by_process: Record<string, number>
}

// Timer types
export interface Timer {
  timer_id: string
  element_id: string
  process_instance_id: string
  timer_type: string
  status: string
  scheduled_at: number
  created_at: number
  time_duration: string
  time_cycle: string
  remaining_seconds: number
  wheel_level: number
}

export interface TimerStats {
  total_timers: number
  pending_timers: number
  fired_timers: number
  cancelled_timers: number
  current_tick: number
  slots_count: number
  timer_types: Record<string, number>
}

// Job types
export interface Job {
  key: string
  type: string
  process_instance_id: string
  process_definition_id: string
  element_id: string
  element_instance_id: string
  custom_headers: Record<string, string>
  variables: Record<string, any>
  retries: number
  deadline: number
  worker?: string
  state: string
  created_at: number
  updated_at: number
}

export interface JobStats {
  total_jobs: number
  active_jobs: number
  completed_jobs: number
  failed_jobs: number
  jobs_by_type: Record<string, number>
  jobs_by_worker: Record<string, number>
  average_latency_ms: number
  throughput_per_minute: number
}

// Message types
export interface Message {
  id: string
  name: string
  correlation_key?: string
  variables: Record<string, any>
  created_at: number
  ttl: number
}

export interface MessageSubscription {
  id: string
  message_name: string
  correlation_key?: string
  process_instance_id: string
  element_id: string
  created_at: number
}

export interface MessageStats {
  total_messages: number
  buffered_messages: number
  delivered_messages: number
  expired_messages: number
  subscriptions_count: number
}

// Expression types
export interface ExpressionResult {
  result: any
  type: string
  success: boolean
  error?: string
}

export interface ExpressionFunction {
  name: string
  description: string
  parameters: string[]
  return_type: string
}

// Incident types
export interface Incident {
  id: string
  type: string
  message: string
  process_instance_id: string
  job_key?: string
  element_id: string
  created_at: number
  resolved_at?: number
  state: string
}

export interface IncidentStats {
  total_incidents: number
  open_incidents: number
  resolved_incidents: number
  incidents_by_type: Record<string, number>
}
