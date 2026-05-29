import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shimmering placeholder shaped exactly like a real MatchCard so the layout
 * doesn't jump when /api/matches resolves.
 */
export function MatchCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
      {/* League header strip */}
      <div className="px-3 sm:px-4 py-2 bg-secondary/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="p-3 sm:p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function MatchListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  )
}
