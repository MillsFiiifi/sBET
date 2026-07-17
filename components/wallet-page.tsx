'use client'

import { useState } from 'react'
import { TRANSACTIONS } from '@/lib/constants'
import {
  CreditCard,
  Download,
  Upload,
  Eye,
  EyeOff,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  TrendingUp,
} from 'lucide-react'

export function WalletPage() {
  const [showBalance, setShowBalance] = useState(true)
  const [activeTab, setActiveTab] = useState<'transactions' | 'methods'>('transactions')

  const balance = 2847.5
  const pendingWithdrawals = 350.0
  const totalWagers = 15420.0
  const totalWins = 3847.5

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Wallet</h1>
          <p className="text-muted-foreground">Manage your balance, deposits, and withdrawals</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Main Balance */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-lg p-6 text-primary-foreground col-span-1 md:col-span-2">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-primary-foreground/80 text-sm font-medium mb-1">Total Balance</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-bold">${balance.toFixed(2)}</h2>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="hover:opacity-80 transition-opacity"
                  >
                    {showBalance ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <CreditCard className="w-8 h-8 opacity-80" />
            </div>
            <div className="flex gap-3">
              <button className="flex-1 bg-primary-foreground text-primary font-medium py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Deposit
              </button>
              <button className="flex-1 bg-primary-foreground/20 text-primary-foreground font-medium py-2 rounded-lg hover:bg-primary-foreground/30 transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>

          {/* Pending Withdrawals */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Pending</p>
              <Zap className="w-4 h-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">${pendingWithdrawals.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Processing</p>
          </div>

          {/* Total Wagers */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Total Wagers</p>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">${totalWagers.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">All time</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm mb-2">Return on Investment</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-accent">+24.9%</span>
              <span className="text-sm text-muted-foreground">vs last month</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm mb-2">Total Wins</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">${totalWins.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">from {TRANSACTIONS.filter(t => t.type === 'bet_win').length} wins</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-4 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'text-accent border-b-2 border-accent -mb-1'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Transaction History
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`pb-4 font-medium text-sm transition-colors ${
                activeTab === 'methods'
                  ? 'text-accent border-b-2 border-accent -mb-1'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Payment Methods
            </button>
          </div>
        </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-3">
            {TRANSACTIONS.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      transaction.type === 'deposit' || transaction.type === 'bet_win'
                        ? 'bg-accent/20 text-accent'
                        : 'bg-destructive/20 text-destructive'
                    }`}
                  >
                    {transaction.type === 'deposit' || transaction.type === 'bet_win' ? (
                      <ArrowDownLeft className="w-6 h-6" />
                    ) : (
                      <ArrowUpRight className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground capitalize">
                      {transaction.type === 'bet_win' ? 'Bet Win' : transaction.type}
                    </p>
                    <p className="text-sm text-muted-foreground">{transaction.method}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        transaction.type === 'deposit' || transaction.type === 'bet_win'
                          ? 'text-accent'
                          : 'text-foreground'
                      }`}
                    >
                      {transaction.type === 'deposit' || transaction.type === 'bet_win' ? '+' : '-'}
                      ${transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{transaction.date}</p>
                  </div>
                  <div className="w-24 text-right">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${
                        transaction.status === 'completed'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {transaction.status === 'completed' ? 'Completed' : 'Processing'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'methods' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Credit Card */}
              <div className="bg-card border border-border rounded-lg p-6 hover:border-accent transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Credit Card</p>
                    <p className="font-semibold text-foreground">•••• •••• •••• 4242</p>
                  </div>
                  <CreditCard className="w-5 h-5 text-accent" />
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-accent/20 text-accent text-sm font-medium rounded hover:bg-accent/30 transition-colors">
                    Use
                  </button>
                  <button className="flex-1 px-3 py-2 border border-border text-foreground text-sm font-medium rounded hover:border-accent transition-colors">
                    Remove
                  </button>
                </div>
              </div>

              {/* Bank Account */}
              <div className="bg-card border border-border rounded-lg p-6 hover:border-accent transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Bank Transfer</p>
                    <p className="font-semibold text-foreground">•••• •••• •••• 5678</p>
                  </div>
                  <Send className="w-5 h-5 text-accent" />
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-accent/20 text-accent text-sm font-medium rounded hover:bg-accent/30 transition-colors">
                    Use
                  </button>
                  <button className="flex-1 px-3 py-2 border border-border text-foreground text-sm font-medium rounded hover:border-accent transition-colors">
                    Remove
                  </button>
                </div>
              </div>

              {/* E-Wallet */}
              <div className="bg-card border border-border rounded-lg p-6 hover:border-accent transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">E-Wallet</p>
                    <p className="font-semibold text-foreground">PayPal Account</p>
                  </div>
                  <CreditCard className="w-5 h-5 text-accent" />
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-accent/20 text-accent text-sm font-medium rounded hover:bg-accent/30 transition-colors">
                    Use
                  </button>
                  <button className="flex-1 px-3 py-2 border border-border text-foreground text-sm font-medium rounded hover:border-accent transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Add New Method */}
            <button className="w-full bg-card border-2 border-dashed border-border rounded-lg p-8 hover:border-accent transition-colors text-center">
              <div className="flex items-center justify-center gap-2 text-accent mb-2">
                <CreditCard className="w-5 h-5" />
                <span className="font-semibold">Add Payment Method</span>
              </div>
              <p className="text-sm text-muted-foreground">Add a new card or bank account</p>
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
