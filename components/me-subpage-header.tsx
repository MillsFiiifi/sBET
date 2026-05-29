import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Shared sticky title bar for every /me/* sub-route so the chrome stays
 * consistent. Pass `backHref` to override the default `/me` destination.
 */
export function MeSubpageHeader({
  title,
  backHref = '/me',
  trailing,
}: {
  title: string
  backHref?: string
  trailing?: React.ReactNode
}) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-10">
      <div className="px-3 sm:px-4 h-14 flex items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back"
          className="p-2 -ml-2 rounded-md hover:bg-secondary transition-colors text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg flex-1 truncate tracking-tight">{title}</h1>
        {trailing}
      </div>
    </header>
  )
}
