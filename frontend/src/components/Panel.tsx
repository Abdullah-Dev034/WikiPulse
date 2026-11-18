import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Panel({ title, subtitle, actions, className = '', children }: PanelProps) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-lg border border-line bg-panel ${className}`}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">{children}</div>
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-panel-raised px-2 py-0.5 text-xs font-medium text-ink-2">
      {children}
    </span>
  )
}
