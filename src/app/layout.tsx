import { IBM_Plex_Mono, Inter } from 'next/font/google'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './runway.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' })
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
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
      <body className={`${inter.variable} ${ibmPlexMono.variable}`}>{children}</body>
    </html>
  )
}
