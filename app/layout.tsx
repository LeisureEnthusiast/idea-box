import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Idea Box — Submit & Vote',
  description: 'Submit ideas and upvote favorites (no sign-in).',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
