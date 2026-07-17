'use client'

import { useEffect, useState } from 'react'
import type { Promotion } from '@/lib/promotions-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Gift,
  Sparkles,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Share2,
} from 'lucide-react'

export function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'claimed'>('active')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/promotions', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) setPromotions(data.promotions ?? [])
      } catch {
        if (!cancelled) setPromotions([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const all = promotions ?? []
  const byStatus = (s: string) => all.filter((p) => p.status === s)
  const visible = byStatus(activeTab)

  const getPromotionIcon = (title: string) => {
    if (title.includes('Welcome')) return Gift
    if (title.includes('Friday') || title.includes('Boost')) return Zap
    if (title.includes('Loyalty') || title.includes('Cashback')) return TrendingUp
    if (title.includes('VIP')) return Sparkles
    return Gift
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-accent/20 text-accent'
      case 'available': return 'bg-primary/20 text-primary'
      case 'claimed': return 'bg-muted/40 text-muted-foreground'
      default: return 'bg-muted/40 text-muted-foreground'
    }
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto space-y-6 lg:space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Gift className="w-8 h-8 text-accent" />
            Promotions & Bonuses
          </h1>
          <p className="text-muted-foreground">Claim exclusive bonuses and take advantage of special promotions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Active Bonuses</p>
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <p className="text-3xl font-bold text-accent">{byStatus('active').length}</p>
            <p className="text-xs text-muted-foreground mt-2">Currently running</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Available Offers</p>
              <Gift className="w-5 h-5 text-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{byStatus('available').length}</p>
            <p className="text-xs text-muted-foreground mt-2">Ready to claim</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Total Offers</p>
              <TrendingUp className="w-5 h-5 text-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{all.length}</p>
            <p className="text-xs text-muted-foreground mt-2">Across all categories</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-8">
            {(['active', 'available', 'claimed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-accent border-b-2 border-accent -mb-1'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'active' ? 'Active Bonuses' : tab === 'available' ? 'Available Offers' : 'Claimed'}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {promotions === null && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
          </div>
        )}

        {/* Promotions Grid */}
        {promotions !== null && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visible.map((promo) => {
              const IconComponent = getPromotionIcon(promo.title)
              return (
                <div key={promo.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-accent transition-all hover:shadow-lg hover:shadow-accent/20">
                  <div className="bg-gradient-to-r from-secondary to-secondary/50 p-6 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-6 h-6 text-accent" />
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(promo.status)}`}>
                          {promo.badge}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{promo.title}</h3>
                    </div>
                    {promo.bonus && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Bonus</p>
                        <p className="text-2xl font-bold text-accent">{promo.bonus}</p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    {promo.description && <p className="text-muted-foreground text-sm">{promo.description}</p>}
                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Percentage</p>
                        <p className="font-semibold text-foreground">{promo.percentage || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Requirements</p>
                        <p className="font-semibold text-foreground text-sm">{promo.requirements || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Expires In
                        </p>
                        <p className="font-semibold text-foreground">{promo.expiresIn || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <p className="font-semibold text-foreground capitalize">{promo.status}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {promo.status === 'active' && (
                        <>
                          <button className="flex-1 bg-accent text-accent-foreground font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity">
                            Claim Now
                          </button>
                          <button className="px-4 py-3 bg-secondary text-foreground hover:bg-secondary/80 transition-colors rounded-lg border border-border">
                            <Share2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {promo.status === 'available' && (
                        <button className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity">
                          Unlock Now
                        </button>
                      )}
                      {promo.status === 'claimed' && (
                        <div className="flex-1 flex items-center justify-center gap-2 bg-muted/20 text-muted-foreground font-semibold py-3 rounded-lg">
                          <CheckCircle className="w-5 h-5" /> Claimed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty */}
        {promotions !== null && visible.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No promotions in this category</h3>
            <p className="text-muted-foreground">Check back soon for more exclusive offers</p>
          </div>
        )}

        {/* Terms */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground mb-2">Terms & Conditions</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Bonuses must be used within the specified expiration date</li>
                <li>Rollover requirements must be met before withdrawing bonus funds</li>
                <li>Promotions cannot be combined unless explicitly stated</li>
                <li>PowerStakeBet reserves the right to modify or cancel promotions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
