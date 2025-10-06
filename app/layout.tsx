import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PGD Copilot — Renaming Ideas',
  description: 'Submit short, professional names aligned to PGD brand essences.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
