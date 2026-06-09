import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import Runway from './Runway'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Runway',
  description: 'Personal Ireland watch planner for TV, streaming, cinema releases, and tracked shows.',
  manifest: '/runway.webmanifest',
  icons: {
    icon: [
      { url: '/runway-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/runway-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/runway-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Runway',
  },
}

export const viewport: Viewport = {
  themeColor: '#31e6b7',
  viewportFit: 'cover',
}

export default async function RunwayPage() {
  if (!(await hasMediaGuideSession())) {
    redirect('/login')
  }

  return <Runway />
}
