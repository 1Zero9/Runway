import { Fraunces, Inter } from 'next/font/google'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './runway.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' })
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: {
    default: 'Runway',
    template: '%s | Runway',
  },
  description: 'Private Ireland watch planner.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-IE">
      <body className={`${inter.variable} ${fraunces.variable}`}>{children}</body>
    </html>
  )
}
