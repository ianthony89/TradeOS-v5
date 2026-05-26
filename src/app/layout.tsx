import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TradeOS',
  description: 'Your personal trading strategy & portfolio hub',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
