'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveUserSession } from '@/lib/user-session'
import { AuthCard, Field, FormError, SubmitButton, inputClass } from '@/components/auth-ui'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      saveUserSession(data.user.id, data.user.name)
      router.push('/')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your SBET account."
      footer={
        <>
          New here?{' '}
          <Link href="/register" className="text-accent font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FormError message={error} />
        <Field label="Email or phone">
          <input
            className={inputClass}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or 0244…"
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
