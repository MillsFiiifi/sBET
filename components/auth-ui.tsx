'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

/* Shared auth UI in the Earthly Richness theme (Deep Green / Brown / Gold). */

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  badge,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  badge?: string
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-5 bg-gradient-to-br from-background via-background to-secondary/40">
      <div className="w-full max-w-[420px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="bg-card border border-border rounded-2xl p-7 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              P
            </span>
            <span className="font-display text-xl font-bold tracking-wide text-foreground">
              PowerStakeBet
            </span>
            {badge && (
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-accent border border-accent/40 bg-accent/10 rounded-full px-2 py-0.5">
                {badge}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-6">{subtitle}</p>

          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-5">{footer}</p>
        )}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted-foreground'

export function SubmitButton({
  loading,
  children,
}: {
  loading?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-accent text-accent-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3.5 py-2.5">
      {message}
    </div>
  )
}
