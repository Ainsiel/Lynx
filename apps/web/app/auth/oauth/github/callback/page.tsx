'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Skeleton } from '@/components/ui/skeleton'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const handleCallback = async () => {
      try {
        await refreshSession()
      } catch {
        if (!cancelled) setError(true)
        return
      }
      if (!cancelled) router.replace('/dashboard')
    }
    handleCallback()
    return () => {
      cancelled = true
    }
  }, [refreshSession, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-destructive">Failed to sign in. Please try again.</p>
          <a href="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-48" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
