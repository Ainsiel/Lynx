import type { LinkResponse } from '@lynx/shared'
import { Card, CardContent } from '@/components/ui/card'
import { CopyButton } from '@/components/copy-button'
import { ExternalLink } from 'lucide-react'

interface StatsSummaryProps {
  link: LinkResponse
  totalClicks: number
}

export function StatsSummary({ link, totalClicks }: StatsSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-4xl font-bold">{totalClicks.toLocaleString()}</p>
            <p className="mt-1 text-sm text-muted-foreground">Total Clicks</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Short URL</p>
              <div className="flex items-center gap-1.5">
                <code className="font-mono text-sm font-semibold">{link.shortUrl}</code>
                <CopyButton text={link.shortUrl} className="h-6 w-6" />
                <a
                  href={link.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="truncate text-sm" title={link.originalUrl}>
                {link.originalUrl}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  link.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {link.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
