import { Playfair_Display, Inter } from 'next/font/google'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './runway.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
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
      <body className={`${inter.variable} ${playfair.variable}`}>{children}</body>
    </html>
  )
}
