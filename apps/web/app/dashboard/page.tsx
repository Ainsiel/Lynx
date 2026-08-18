'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { LinkResponse, LinkListResponse } from '@lynx/shared'
import { api, extractErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LinkCard } from '@/components/link-card'
import { Pagination } from '@/components/pagination'
import { EmptyState } from '@/components/empty-state'
import { Plus, RefreshCw } from 'lucide-react'

const PAGE_SIZE = 20

export default function DashboardPage() {
  const { accessToken } = useAuth()
  const [links, setLinks] = useState<LinkResponse[]>([])
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLinks = useCallback(
    async (pageNum: number) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await api.get<LinkListResponse>(
          `/api/links?page=${pageNum}&pageSize=${PAGE_SIZE}`,
          accessToken ?? undefined,
        )
        setLinks(data.data)
        setTotalItems(data.totalItems)
      } catch (err) {
        const message = extractErrorMessage(err, 'Failed to load links')
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [accessToken],
  )

  useEffect(() => {
    fetchLinks(page)
  }, [page, fetchLinks])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Manage your shortened links</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLinks(page)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/dashboard/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Link
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-4" onClick={() => fetchLinks(page)}>
            Retry
          </Button>
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          title="No links yet"
          description="Create your first shortened link to get started."
          actionLabel="Create Link"
          actionHref="/dashboard/new"
        />
      ) : (
        <>
          <div className="space-y-3">
            {links.map((link) => (
              <LinkCard key={link.id} link={link} onUpdated={() => fetchLinks(page)} />
            ))}
          </div>
          <Pagination
            page={page}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  )
}
