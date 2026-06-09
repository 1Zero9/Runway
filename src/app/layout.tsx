import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './runway.css'

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
      <body>{children}</body>
    </html>
  )
}
