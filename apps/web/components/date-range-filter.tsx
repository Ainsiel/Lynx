'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RotateCcw } from 'lucide-react'

interface DateRangeFilterProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDefaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return { from: formatDateForInput(from), to: formatDateForInput(to) }
}

export { getDefaultRange }

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const defaults = getDefaultRange()
  const isDefault = from === defaults.from && to === defaults.to

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="w-[150px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="to"
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="w-[150px]"
        />
      </div>
      {!isDefault && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(defaults.from, defaults.to)}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  )
}
