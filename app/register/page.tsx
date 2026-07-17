'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveUserSession } from '@/lib/user-session'
import { listCountries, getCountry, DEFAULT_COUNTRY } from '@/lib/countries'
import { AuthCard, Field, FormError, SubmitButton, inputClass } from '@/components/auth-ui'

export default function RegisterPage() {
  const router = useRouter()
  const countries = useMemo(() => listCountries(), [])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY)
  const [kyc, setKyc] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const cfg = getCountry(country)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          country,
          kyc: cfg.requiresKyc ? kyc : undefined,
          referralCode: referralCode || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Registration failed')
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
      title="Create your account"
      subtitle="Join SBET and start betting in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-accent font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FormError message={error} />
        <Field label="Full name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kwame Mensah"
            required
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country">
            <select
              className={inputClass}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone" hint={`${cfg.name} number`}>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={`0…  (+${cfg.dialCode})`}
              required
            />
          </Field>
        </div>
        {cfg.requiresKyc && (
          <Field label={cfg.kycLabel}>
            <input
              className={inputClass}
              value={kyc}
              onChange={(e) => setKyc(e.target.value)}
              placeholder={cfg.kycPlaceholder}
              required
            />
          </Field>
        )}
        <Field label="Password" hint="At least 6 characters">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>
        <Field label="Referral code" hint="Optional — from a partner/sub-admin">
          <input
            className={`${inputClass} uppercase`}
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="e.g. SBET7X"
          />
        </Field>
        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
    </AuthCard>
  )
}
