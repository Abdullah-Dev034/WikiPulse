import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  subtitle?: string
  className?: string
  children: ReactNode
}

export function Panel({ title, subtitle, className = '', children }: PanelProps) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-xl border border-line bg-panel p-4 ${className}`}
    >
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>
}
