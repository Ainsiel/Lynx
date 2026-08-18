'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateLinkInputSchema, type CreateLinkInput } from '@lynx/shared'
import { api, extractErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CreateLinkPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateLinkInput>({
    resolver: zodResolver(CreateLinkInputSchema),
  })

  const onSubmit = async (data: CreateLinkInput) => {
    setIsPending(true)
    try {
      const idempotencyKey = crypto.randomUUID()
      await api.post(
        '/api/links',
        data,
        accessToken ?? undefined,
        { 'Idempotency-Key': idempotencyKey },
      )
      toast.success('Link created successfully!')
      router.push('/dashboard')
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to create link'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Create Link</h1>
        <p className="text-muted-foreground">Shorten a URL to share</p>
      </div>
      <Card className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>New Link</CardTitle>
            <CardDescription>
              Enter a URL to shorten. Optionally provide a custom slug.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="originalUrl">Destination URL</Label>
              <Input
                id="originalUrl"
                placeholder="https://example.com/very-long-url"
                {...register('originalUrl')}
              />
              {errors.originalUrl && (
                <p className="text-sm text-destructive">{errors.originalUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customSlug">
                Custom Slug{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="customSlug"
                placeholder="my-link"
                {...register('customSlug')}
              />
              {errors.customSlug && (
                <p className="text-sm text-destructive">{errors.customSlug.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                6-10 characters: letters, numbers, hyphens, underscores. Leave empty for auto-generated.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Link'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
