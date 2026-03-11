import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Job {
  id: string
  url: string
  mode: string
  page_limit: number | null
  wait_seconds: number | null
  main_content: boolean | null
  status: string
  error: string | null
  pages_crawled: number | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface ResultMetadata {
  title: string | null
  description: string | null
  language: string | null
  canonical_url: string | null
  og_image: string | null
  favicon: string | null
  word_count: number
  links_internal: number
  links_external: number
  images_count: number
  headings: string[]
  response_time_ms: number
  used_proxy: boolean
  crawled_at: string
}

export interface ResultItem {
  url: string
  markdown: string
  metadata: ResultMetadata
}

export interface JobDetail {
  task_id: string
  status: string
  url: string
  mode: string
  pages_crawled: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string | null
  results: ResultItem[]
}

export interface JobListResponse {
  jobs: Job[]
  total: number
  limit: number
  offset: number
}

export interface HealthResponse {
  status: string
  redis: string
  sqlite: string
}

export interface JobStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  total_pages_crawled: number
  avg_response_time_ms: number
  total_results: number
}

export interface StatsResponse {
  jobs: JobStats
  queue_depth: number
  max_workers: number
}

export interface RecentActivity {
  id: string
  url: string
  status: string
  mode: string
  pages_crawled: number | null
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface QueueStatusResponse {
  queue_depth: number
  max_workers: number
  running_jobs: number
  queued_jobs: number
  recent_activity: RecentActivity[]
}

export interface SystemConfig {
  port: number
  max_workers: number
  proxy_configured: boolean
  proxy_mode: string
  database_url: string
  redis_url: string
}

export interface SystemInfoResponse {
  health: HealthResponse
  config: SystemConfig
  recent_errors: Job[]
}

export interface CleanupResponse {
  removed_count: number
  freed_bytes: number
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function useJobs(limit = 50, offset = 0) {
  return useQuery<JobListResponse>({
    queryKey: ["jobs", limit, offset],
    queryFn: () => apiFetch(`/api/scrape?limit=${limit}&offset=${offset}`),
    refetchInterval: 2000,
  })
}

export function useJob(taskId: string) {
  return useQuery<JobDetail>({
    queryKey: ["job", taskId],
    queryFn: () => apiFetch(`/api/scrape/${taskId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === "completed" || status === "failed") return false
      return 1000
    },
  })
}

export function useSubmitJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      url: string
      mode: string
      limit: number
      wait_seconds: number
      main_content: boolean
    }) =>
      apiFetch<{ task_id: string }>("/api/scrape", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
      qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/api/scrape/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: () => apiFetch("/api/stats"),
    refetchInterval: 3000,
  })
}

export function useQueueStatus() {
  return useQuery<QueueStatusResponse>({
    queryKey: ["queue"],
    queryFn: () => apiFetch("/api/queue/status"),
    refetchInterval: 2000,
  })
}

export function useSystemInfo() {
  return useQuery<SystemInfoResponse>({
    queryKey: ["system"],
    queryFn: () => apiFetch("/api/system"),
    refetchInterval: 5000,
  })
}

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => apiFetch("/api/health"),
    refetchInterval: 10000,
  })
}

export function useCleanupStorage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { mode: "orphaned" | "all" }) =>
      apiFetch<CleanupResponse>(`/api/cleanup?mode=${params.mode}`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system"] })
    },
  })
}

export { apiFetch }
