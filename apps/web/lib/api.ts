import type { Rfc7807Problem } from '@lynx/shared'

class ApiError extends Error {
  status: number
  problem: Rfc7807Problem

  constructor(problem: Rfc7807Problem) {
    super(problem.detail)
    this.name = 'ApiError'
    this.status = problem.status
    this.problem = problem
  }
}

type ExtraHeaders = Record<string, string>

function buildHeaders(accessToken?: string, extra?: ExtraHeaders): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (extra) Object.assign(headers, extra)
  return headers
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
  })

  if (!res.ok) {
    try {
      const problem = (await res.json()) as Rfc7807Problem
      throw new ApiError(problem)
    } catch (err) {
      if (err instanceof ApiError) throw err
      throw new ApiError({
        type: 'about:blank',
        title: 'Unknown Error',
        status: res.status,
        detail: `Request failed with status ${res.status}`,
        instance: path,
      })
    }
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, accessToken?: string) =>
    request<T>(path, {
      headers: buildHeaders(accessToken),
    }),

  post: <T>(path: string, body: unknown, accessToken?: string, extraHeaders?: ExtraHeaders) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: buildHeaders(accessToken, extraHeaders),
    }),

  patch: <T>(path: string, body: unknown, accessToken?: string) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: buildHeaders(accessToken),
    }),

  delete: <T>(path: string, body?: unknown, accessToken?: string) =>
    request<T>(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      headers: buildHeaders(accessToken),
    }),
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.problem.detail
  return fallback
}

export { ApiError }
