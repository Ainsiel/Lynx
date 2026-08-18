'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { LinkResponse } from '@lynx/shared'
import { api, extractErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExternalLink, Trash2, Power } from 'lucide-react'

interface LinkCardProps {
  link: LinkResponse
  onUpdated: () => void
}

export function LinkCard({ link, onUpdated }: LinkCardProps) {
  const { accessToken } = useAuth()
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleToggleActive = async () => {
    setIsDeactivating(true)
    try {
      await api.patch(
        `/api/links/${link.slug}`,
        { isActive: !link.isActive },
        accessToken ?? undefined,
      )
      toast.success(link.isActive ? 'Link deactivated' : 'Link activated')
      onUpdated()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to update link'))
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.delete(`/api/links/${link.slug}`, undefined, accessToken ?? undefined)
      toast.success('Link deleted')
      setShowDeleteDialog(false)
      onUpdated()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete link'))
    } finally {
      setIsDeleting(false)
    }
  }

  const createdDate = new Date(link.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <>
      <Card className={link.isActive ? '' : 'opacity-60'}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{link.slug}</span>
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
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <span className="truncate">{link.shortUrl}</span>
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
            <p className="mt-1 truncate text-xs text-muted-foreground" title={link.originalUrl}>
              {link.originalUrl}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Created {createdDate}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleActive}
              disabled={isDeactivating}
              title={link.isActive ? 'Deactivate' : 'Activate'}
            >
              <Power className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete link</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>/{link.slug}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
