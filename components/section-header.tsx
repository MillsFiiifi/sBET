import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  /** Optional muted line below the title. */
  description?: string
  /** Optional small icon shown to the left of the title (e.g. live dot). */
  icon?: React.ReactNode
  /** Count chip rendered to the right of the title (e.g. "12"). */
  count?: number
  /** "View all" affordance — href makes it a Link, action makes it a button. */
  viewAllHref?: string
  viewAllLabel?: string
}

/**
 * Consistent section title used across the home page and match feeds.
 * Establishes a single hierarchy so vertical rhythm stays predictable.
 */
export function SectionHeader({
  title,
  description,
  icon,
  count,
  viewAllHref,
  viewAllLabel = 'View all',
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {icon}
          <h2 className="text-title font-bold tracking-tight">{title}</h2>
          {typeof count === 'number' && count > 0 && (
            <span className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="shrink-0 inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {viewAllLabel}
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
