'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthCard, Field, FormError, SubmitButton, inputClass } from '@/components/auth-ui'

export default function SubAdminLoginPage() {
  return (
    <Suspense>
      <SubAdminLoginInner />
    </Suspense>
  )
}

function SubAdminLoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/sub-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      router.push(params.get('next') || '/sub-admin/dashboard')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Partner sign in"
      subtitle="Access your referral dashboard."
      badge="Partner"
      footer={
        <>
          Want to become a partner?{' '}
          <Link href="/sub-admin/register" className="text-accent font-medium hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FormError message={error} />
        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </AuthCard>
  )
}
