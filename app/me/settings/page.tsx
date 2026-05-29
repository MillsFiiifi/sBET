'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Shield,
  User as UserIcon,
} from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clearUserSession, getUserId } from '@/lib/user-session'

interface UserProfile {
  id: string
  name: string
  email: string
  phone: string | null
  country: 'GH' | 'NG' | 'KE' | 'ZA'
  currency: 'GHS' | 'NGN' | 'KES' | 'ZAR'
}

export default function SettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    const uid = getUserId()
    setUserId(uid)
    if (!uid) return
    void fetch(`/api/users/${uid}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)))
      .then((data: UserProfile) => setProfile(data))
      .catch((e) => setProfileError(String(e)))
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    if (!userId) return
    setPwLoading(true)
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : String(err))
    } finally {
      setPwLoading(false)
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
        <MeSubpageHeader title="Settings" />
        <main className="flex-1 p-6 text-center max-w-sm mx-auto w-full">
          <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
          <div className="mt-6 flex gap-3">
            <Link href="/login" className="flex-1 h-12 inline-flex items-center justify-center rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/10 transition-colors">Login</Link>
            <Link href="/register" className="flex-1 h-12 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">Register</Link>
          </div>
        </main>
        <MobileNav selectedBets={[]} activeTab="me" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
      <MeSubpageHeader title="Settings" />

      <main className="flex-1 px-3 sm:px-4 pt-4 space-y-5">
        {/* Profile section */}
        <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <p className="text-eyebrow text-muted-foreground mb-3">Profile</p>
          {profileError ? (
            <p className="text-xs text-destructive font-medium">{profileError}</p>
          ) : !profile ? (
            <div className="space-y-2">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
          ) : (
            <ul className="divide-y divide-border -mx-1">
              <ProfileRow icon={<UserIcon className="w-4 h-4" />} label="Name" value={profile.name} />
              <ProfileRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.email} />
              <ProfileRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.phone ?? '—'} />
              <ProfileRow
                icon={<Shield className="w-4 h-4" />}
                label="Country"
                value={`${profile.country} · ${profile.currency}`}
              />
            </ul>
          )}
        </section>

        {/* Change password */}
        <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <p className="text-eyebrow text-muted-foreground mb-3">Change password</p>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <PasswordField
              id="current"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
            />
            <PasswordField
              id="new"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              minLength={6}
            />
            <PasswordField
              id="confirm"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              minLength={6}
            />

            {pwError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="p-2.5 rounded-lg bg-success/10 border border-success/30 text-xs text-success font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Password updated.
              </div>
            )}

            <Button
              type="submit"
              disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              {pwLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>
        </section>

        {/* Sign out */}
        <section>
          <Button
            variant="outline"
            className="w-full h-11 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => {
              clearUserSession()
              router.push('/login')
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </section>
      </main>

      <MobileNav selectedBets={[]} activeTab="me" />
    </div>
  )
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 px-1">
      <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </li>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  minLength,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  minLength?: number
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 h-11 bg-secondary border-border"
          required
          minLength={minLength}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
