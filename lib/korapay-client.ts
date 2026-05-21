/**
 * Shared types for the Korapay inline checkout JS SDK.
 * The SDK is loaded from a CDN at runtime, so we declare its shape here.
 */

export interface KorapaySuccess {
  reference: string
  amount?: number
  status?: string
}

export interface KorapayFailure {
  reason?: string
}

export interface KorapayInitConfig {
  key: string
  reference: string
  amount: number
  currency: string
  customer: { name: string; email: string }
  notification_url?: string
  onClose?: () => void
  onSuccess?: (data: KorapaySuccess) => void
  onFailed?: (data: KorapayFailure) => void
}

export interface KorapaySDK {
  initialize: (config: KorapayInitConfig) => void
  close?: () => void
}

declare global {
  interface Window {
    Korapay?: KorapaySDK
  }
}

export const KORAPAY_SDK_SRC =
  'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js'
