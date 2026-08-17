'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ResetPasswordInputSchema, type ResetPasswordInput } from '@lynx/shared'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordInputSchema),
    defaultValues: { token: token ?? '' },
  })

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Invalid link</CardTitle>
          <CardDescription>This password reset link is invalid or missing a token.</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Request a new reset link
          </Link>
        </CardFooter>
      </Card>
    )
  }

  const onSubmit = async (data: ResetPasswordInput) => {
    setError(null)
    setIsPending(true)
    try {
      await api.post('/api/auth/reset-password', data)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem.detail)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setIsPending(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Password updated</CardTitle>
          <CardDescription>
            Your password has been reset. Redirecting to sign in...
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Sign in now
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>Enter your new password</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <input type="hidden" {...register('token')} />
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Resetting...' : 'Reset password'}
          </Button>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}

function ResetPasswordFallback() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Reset password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
