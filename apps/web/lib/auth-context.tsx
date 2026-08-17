'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'
import type { UserResponse, AuthResponse, RefreshResponse } from '@lynx/shared'

interface AuthContextValue {
  user: UserResponse | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.post<RefreshResponse>('/api/auth/refresh', { refreshToken: '' })
      setAccessToken(data.accessToken)
      const me = await api.get<UserResponse>('/api/auth/me', data.accessToken)
      setUser(me)
    } catch {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false))
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/api/auth/login', { email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api.post<AuthResponse>('/api/auth/register', { name, email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await api.delete('/api/auth/logout', { refreshToken: '' }, accessToken)
      }
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [accessToken])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
