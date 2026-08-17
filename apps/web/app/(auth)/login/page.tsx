'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoginInputSchema, type LoginInput } from '@lynx/shared'
import { useAuth } from '@/lib/auth-context'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setError(null)
    setIsPending(true)
    try {
      await login(data.email, data.password)
      router.push('/dashboard')
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

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your LYNX account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-primary hover:underline">
              Forgot your password?
            </Link>
            <span>
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </span>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
