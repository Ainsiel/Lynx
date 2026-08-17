import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkIcon } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage your shortened links</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            My Links
          </CardTitle>
          <CardDescription>
            Create and manage your shortened URLs. Click analytics coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <LinkIcon className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Coming soon</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Link management and analytics will be available in the next release.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
