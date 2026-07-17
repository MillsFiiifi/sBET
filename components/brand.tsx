import Link from 'next/link'
import { cn } from '@/lib/utils'

/* PowerStakeBet wordmark. */

export function LogoMark({ size = 32 }: { size?: number; id?: string }) {
  return (
    <span
      className="grid place-items-center rounded-lg bg-primary text-primary-foreground font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      P
    </span>
  )
}

export function Brand({
  size = 32,
  className,
  id = 'main',
  pro = true,
  href = '/',
}: {
  size?: number
  className?: string
  id?: string
  pro?: boolean
  href?: string | null
}) {
  const inner = (
    <span className={cn('flex items-center gap-2 select-none', className)}>
      <LogoMark size={size} id={id} />
      <span className="font-display font-bold tracking-wide text-foreground" style={{ fontSize: size * 0.62 }}>
        PowerStakeBet
      </span>
      {pro && (
        <span className="text-[9px] font-bold tracking-[0.18em] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent">
          PRO
        </span>
      )}
    </span>
  )
  if (href === null) return inner
  return <Link href={href}>{inner}</Link>
}
