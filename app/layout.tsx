import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'PowerStakeBet | Sports Betting',
  description: 'PowerStakeBet — Live sports odds, real matches, smart betting.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/powerstakebet-icon.svg', type: 'image/svg+xml' },
      { url: '/powerstakebet.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/powerstakebet.png',
    apple: '/powerstakebet.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#16A34A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
