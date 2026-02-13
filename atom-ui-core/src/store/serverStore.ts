import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ServerConfig } from '../types/api'

interface ServerStore {
  servers: ServerConfig[]
  currentServerId: string | null
  setServers: (servers: ServerConfig[]) => void
  setCurrentServer: (serverId: string) => void
  getCurrentServer: () => ServerConfig | null
  addServer: (server: ServerConfig) => void
  updateServer: (serverId: string, updates: Partial<ServerConfig>) => void
  removeServer: (serverId: string) => void
}

// Load servers from environment variable
const loadServersFromEnv = (): ServerConfig[] => {
  try {
    const serversJson = import.meta.env.VITE_SERVERS
    if (serversJson) {
      const servers = JSON.parse(serversJson)
      if (Array.isArray(servers)) {
        return servers
      }
    }
  } catch (error) {
    console.error('Failed to load servers from environment:', error)
  }
  
  // Default server if no environment configuration (empty URL for proxy)
  return [{
    id: 'default',
    name: 'Local Server',
    url: '',
    apiKey: 'ak_dev_example_AbC123XyZ456'
  }]
}

const initialServers = loadServersFromEnv()
const defaultServerId = import.meta.env.VITE_DEFAULT_SERVER || (initialServers[0]?.id ?? null)

// Force reset localStorage if servers have wrong URLs
const storedState = localStorage.getItem('atom-ui-servers')
if (storedState) {
  try {
    const parsed = JSON.parse(storedState)
    if (parsed?.state?.servers) {
      const hasInvalidUrl = parsed.state.servers.some((s: ServerConfig) => 
        s.url && s.url.includes('localhost:27555')
      )
      if (hasInvalidUrl) {
        console.log('[ServerStore] Resetting localStorage due to invalid URLs')
        localStorage.removeItem('atom-ui-servers')
        window.location.reload()
      }
    }
  } catch (e) {
    console.error('[ServerStore] Failed to check localStorage:', e)
  }
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set, get) => ({
      servers: initialServers,
      currentServerId: defaultServerId,

      setServers: (servers) => set({ servers }),

      setCurrentServer: (serverId) => {
        const server = get().servers.find(s => s.id === serverId)
        if (server) {
          set({ currentServerId: serverId })
        }
      },

      getCurrentServer: () => {
        const state = get()
        return state.servers.find(s => s.id === state.currentServerId) || null
      },

      addServer: (server) => set((state) => ({
        servers: [...state.servers, server]
      })),

      updateServer: (serverId, updates) => set((state) => ({
        servers: state.servers.map(s =>
          s.id === serverId ? { ...s, ...updates } : s
        )
      })),

      removeServer: (serverId) => set((state) => {
        const newServers = state.servers.filter(s => s.id !== serverId)
        const newCurrentId = state.currentServerId === serverId
          ? (newServers[0]?.id ?? null)
          : state.currentServerId
        
        return {
          servers: newServers,
          currentServerId: newCurrentId
        }
      }),
    }),
    {
      name: 'atom-ui-servers',
    }
  )
)
