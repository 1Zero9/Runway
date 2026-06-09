'use client'

import { Lock, MonitorPlay } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import '../runway.css'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/media-guide/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Could not sign in.')
      }

      router.replace(searchParams.get('next') || '/')
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="media-login">
      <form className="media-login-panel" onSubmit={submitLogin}>
        <div className="media-login-mark">
          <MonitorPlay size={30} />
        </div>
        <p className="eyebrow">Private access</p>
        <h1>Runway</h1>
        <p>Enter your Runway password to continue.</p>
        <label className="settings-field">
          Password
          <span className="media-password-field">
            <Lock size={18} />
            <input
              autoComplete="current-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </span>
        </label>
        {error && <p className="notice error">{error}</p>}
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? 'Checking...' : 'Open Runway'}
        </button>
      </form>
    </main>
  )
}
