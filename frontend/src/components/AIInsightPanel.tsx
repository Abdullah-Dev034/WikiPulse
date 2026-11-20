import { Sparkles } from 'lucide-react'

/**
 * Placeholder slot for the AI pulse summary. The backend does not produce summaries yet,
 * so this shows an honest "not enabled" state instead of sample text.
 */
export function AIInsightPanel() {
  return (
    <section
      aria-label="AI pulse"
      className="flex items-start gap-3 rounded-lg border border-line bg-panel px-5 py-4"
    >
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-panel-raised text-ink-2">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">AI pulse</h2>
        <p className="mt-0.5 text-sm text-muted">
          AI trend summaries are not enabled yet. When configured, a short plain-English summary of
          what is trending will appear here, generated only from the statistics on this page.
        </p>
      </div>
    </section>
  )
}
