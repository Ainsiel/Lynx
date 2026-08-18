'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { LinkResponse, StatsResponse, StatsGroupBy } from '@lynx/shared'
import { api, extractErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatsSummary } from '@/components/stats-summary'
import { StatsChart } from '@/components/stats-chart'
import { DateRangeFilter, getDefaultRange } from '@/components/date-range-filter'
import { QrCode } from '@/components/qr-code'
import { ArrowLeft, BarChart3, QrCode as QrCodeIcon } from 'lucide-react'

export default function LinkDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { accessToken } = useAuth()

  const [link, setLink] = useState<LinkResponse | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [isLoadingLink, setIsLoadingLink] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState(() => getDefaultRange().from)
  const [to, setTo] = useState(() => getDefaultRange().to)
  const [activeTab, setActiveTab] = useState<StatsGroupBy>('day')
  const [showQrDialog, setShowQrDialog] = useState(false)

  const fetchLink = useCallback(async () => {
    setIsLoadingLink(true)
    setError(null)
    try {
      const res = await api.get<{ data: LinkResponse[] }>(
        `/api/links?page=1&pageSize=200`,
        accessToken ?? undefined,
      )
      const found = res.data.find((l) => l.slug === slug)
      if (!found) {
        setError('Link not found')
        return
      }
      setLink(found)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load link'))
    } finally {
      setIsLoadingLink(false)
    }
  }, [slug, accessToken])

  const fetchStats = useCallback(
    async (groupBy: StatsGroupBy, fromStr: string, toStr: string) => {
      setIsLoadingStats(true)
      try {
        const params = new URLSearchParams({
          groupBy,
          page: '1',
          pageSize: '100',
        })
        if (fromStr) params.set('from', new Date(fromStr).toISOString())
        if (toStr) params.set('to', new Date(toStr + 'T23:59:59').toISOString())

        const res = await api.get<StatsResponse>(
          `/api/links/${slug}/stats?${params.toString()}`,
          accessToken ?? undefined,
        )
        setStats(res)
      } catch (err) {
        toast.error(extractErrorMessage(err, 'Failed to load stats'))
      } finally {
        setIsLoadingStats(false)
      }
    },
    [slug, accessToken],
  )

  useEffect(() => {
    fetchLink()
  }, [fetchLink])

  useEffect(() => {
    if (link) {
      fetchStats(activeTab, from, to)
    }
  }, [link, activeTab, from, to, fetchStats])

  const handleDateChange = (newFrom: string, newTo: string) => {
    setFrom(newFrom)
    setTo(newTo)
  }

  if (isLoadingLink) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[100px]" />
          <Skeleton className="h-[100px]" />
        </div>
        <Skeleton className="h-[350px]" />
      </div>
    )
  }

  if (error || !link) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to dashboard
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">{error ?? 'Link not found'}</p>
            <Button variant="link" asChild className="mt-2">
              <Link href="/dashboard">Go back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">/{link.slug}</h1>
          <p className="text-sm text-muted-foreground">{link.originalUrl}</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setShowQrDialog(true)}>
            <QrCodeIcon className="mr-1 h-4 w-4" />
            QR Code
          </Button>
        </div>
      </div>

      <StatsSummary link={link} totalClicks={stats?.total ?? 0} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Analytics</h2>
          <DateRangeFilter from={from} to={to} onChange={handleDateChange} />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatsGroupBy)}>
          <TabsList>
            <TabsTrigger value="day">By Day</TabsTrigger>
            <TabsTrigger value="country">By Country</TabsTrigger>
            <TabsTrigger value="device">By Device</TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoadingStats ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <StatsChart data={stats?.breakdown ?? []} groupBy="day" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="country" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoadingStats ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <StatsChart data={stats?.breakdown ?? []} groupBy="country" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="device" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoadingStats ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <StatsChart data={stats?.breakdown ?? []} groupBy="device" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code — /{link.slug}</DialogTitle>
          </DialogHeader>
          <QrCode value={link.shortUrl} slug={link.slug} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
