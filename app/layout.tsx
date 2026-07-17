import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'

// Body: clean, readable sans. Display: Cinzel — an engraved, gold-leaf serif
// that carries the "Earthly Richness" luxury/wealth feel.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PowerStakeBet — Sports Betting Platform',
  description: 'PowerStakeBet — next-generation sports betting with live matches and real-time odds',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#12100b' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Apply the saved theme + accent before first paint to avoid a flash.
  const themeScript = `(function(){try{
    var raw=localStorage.getItem('sbet_settings'); if(!raw)return;
    var s=JSON.parse(raw); var root=document.documentElement;
    var t=s.theme==='light'?'light':'dark';
    root.classList.remove('light','dark'); root.classList.add(t);
    var A={blue:['#2f7bff','#ffffff'],orange:['#f97316','#0b1220'],green:['#22c55e','#0b1220'],purple:['#a855f7','#ffffff'],red:['#ef4444','#ffffff'],pink:['#ec4899','#ffffff']};
    var a=A[s.accent]||A.blue; var set=function(k,v){root.style.setProperty(k,v)};
    set('--primary',a[0]);set('--primary-foreground',a[1]);set('--accent',a[0]);set('--accent-foreground',a[1]);set('--ring',a[0]);
    set('--sidebar-primary',a[0]);set('--sidebar-primary-foreground',a[1]);set('--sidebar-accent',a[0]);set('--sidebar-accent-foreground',a[1]);set('--sidebar-ring',a[0]);
  }catch(e){}})();`

  return (
    <html lang="en" className={`dark ${inter.variable} ${cinzel.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
