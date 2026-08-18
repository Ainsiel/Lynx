'use client'

import type { StatsBreakdownItem, StatsGroupBy } from '@lynx/shared'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

interface StatsChartProps {
  data: StatsBreakdownItem[]
  groupBy: StatsGroupBy
}

function getLabel(item: StatsBreakdownItem, groupBy: StatsGroupBy): string {
  if (groupBy === 'day') return item.date ?? 'Unknown'
  if (groupBy === 'country') return item.country ?? 'Unknown'
  return item.device ?? 'Unknown'
}

function formatLabel(label: string, groupBy: StatsGroupBy): string {
  if (groupBy === 'day') {
    const d = new Date(label)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function StatsChart({ data, groupBy }: StatsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data to display
      </div>
    )
  }

  const chartData = data.map((item) => ({
    name: formatLabel(getLabel(item, groupBy), groupBy),
    clicks: item.clicks,
  }))

  if (groupBy === 'day') {
    return (
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              className="text-xs"
              tick={{ fontSize: 12 }}
            />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(props: { name?: string; percent?: number }) => `${props.name ?? ''} (${((props.percent ?? 0) * 100).toFixed(0)}%)`}
            outerRadius={100}
            dataKey="clicks"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--popover-foreground))',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
