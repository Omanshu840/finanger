import { useState, useId } from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import type { AllocationSlice } from '../hooks/useNetWorthSummary'
import { formatINR } from '@/lib/currency'

interface AllocationDonutProps {
  data: AllocationSlice[]
  netWorth: number
}

export function AllocationDonut({ data, netWorth }: AllocationDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const labelId = useId()
  const active = activeIndex != null ? data[activeIndex] : null

  if (data.length === 0) return null

  return (
    <div
      className="relative mx-auto w-full max-w-64 sm:max-w-none"
      style={{ paddingBottom: '100%', height: 0 }}
      role="img"
      aria-labelledby={labelId}
    >
      {/* Accessible label for screen readers */}
      <span id={labelId} className="sr-only">
        Asset allocation donut chart. Total net worth {formatINR(netWorth)}.{' '}
        {data.map((s) => `${s.label}: ${s.percentage.toFixed(1)}%`).join(', ')}.
      </span>

      <div className="absolute inset-0" aria-hidden="true">
        <PieChart responsive>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="54%"
            outerRadius="72%"
            paddingAngle={2}
            strokeWidth={0}
            onMouseEnter={(_, i) => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            // Touch support
            onTouchStart={(_, i) => setActiveIndex(i)}
            onTouchEnd={() => setActiveIndex(null)}
          >
            {data.map((slice) => (
              <Cell key={slice.type} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>

        {/* CSS-overlaid centre text */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {active ? (
            <>
              <span className="text-[10px] font-medium text-muted-foreground leading-none">
                {active.label}
              </span>
              <span className="text-base font-bold tabular-nums leading-tight">
                {formatINR(active.value)}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">
                {active.percentage.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-medium text-muted-foreground leading-none">
                Total
              </span>
              <span className="text-base font-bold tabular-nums leading-tight">
                {formatINR(netWorth)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
