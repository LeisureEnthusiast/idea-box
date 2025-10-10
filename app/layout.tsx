import './globals.css'
import type { Metadata } from 'next'

// ⚠️ Use your live domain here (no trailing slash)
const SITE = 'https://nexteraenergy.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'PGD Copilot — Renaming Ideas',
  description: 'Submit short, professional names aligned to PGD brand essences.',
  openGraph: {
    title: 'PGD Copilot — Renaming Ideas',
    description: 'Submit short, professional names aligned to PGD brand essences.',
    url: '/',
    siteName: 'NextEra Energy',
    images: [
      {
        url: '/brand/og-card.png', // served as absolute from metadataBase
        width: 1200,
        height: 630,
        type: 'image/png',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PGD Copilot — Renaming Ideas',
    description: 'Submit short, professional names aligned to PGD brand essences.',
    images: ['/brand/og-card.png'],
  },
  icons: { icon: '/favicon.ico' }, // optional
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
