'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Idea Box'

type Idea = { id: string; text: string; votes: number; created_at: string }

export default function Page() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    // Initialize Teams (safe outside Teams too)
    microsoftTeams.app.initialize().catch(() => {})
  }, [])

  const fetchIdeas = async () => {
    try {
      const res = await fetch('/api/list', { cache: 'no-store' })
      const json = await res.json()
      setIdeas(json.items || [])
    } catch {}
  }

  useEffect(() => {
    fetchIdeas()
    pollRef.current = window.setInterval(fetchIdeas, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const sorted = useMemo(
    () => [...ideas].sort((a, b) => (b.votes || 0) - (a.votes || 0)),
    [ideas]
  )

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setLoading(true)
    setErr('')
    try {
      // Quick local duplicate check
      const norm = normalize(value)
      const local = ideas.find(i => normalize(i.text) === norm)
      if (local) {
        setErr("Looks like someone already submitted that idea, take a look below to vote for it!")
        document.getElementById(`idea-${local.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value.slice(0, 80) }),
      })

      // Handle server-side duplicate (409)
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        setErr("Looks like someone already submitted that idea, take a look below to vote for it!")
        // ensure we have the latest list, then scroll
        await fetchIdeas()
        const id = body?.duplicateOf
        if (id) {
          setTimeout(() => {
            document.getElementById(`idea-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }
        return
      }

      if (!res.ok) throw new Error('Submit failed')

      setText('')
      fetchIdeas()
    } catch (e: any) {
      setErr(e?.message || 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  const vote = async (id: string) => {
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Vote failed')
      fetchIdeas()
    } catch {
      alert('Vote failed. Try again shortly.')
    }
  }

  return (
    <div className="container">
      <h1 style={{ margin: '8px 0' }}>{APP_NAME} — Project Name Ideas</h1>
      <p className="small">Submit an idea and upvote your favorites. No sign-in required.</p>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, margin: '12px 0 16px' }}>
        <input
          className="input"
          placeholder="Your idea (max 80 chars)"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={80}
        />
        <button className="button" disabled={!text.trim() || loading}>
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {err && <div style={{ color: 'crimson', marginBottom: 12 }}>{err}</div>}

      <ul className="list">
        {sorted.map(it => (
          <li key={it.id} id={`idea-${it.id}`} className="card">
            <div className="row">
              <div>
                <div style={{ fontWeight: 600 }}>{it.text}</div>
                <div className="small">Votes: {it.votes}</div>
              </div>
              <button className="button" onClick={() => vote(it.id)}>👍 Upvote</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
