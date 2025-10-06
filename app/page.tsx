'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'
import Image from 'next/image'

const APP_NAME = 'PGD Copilot — Renaming Ideas'

type Idea = {
  id: string
  text: string
  votes: number
  created_at: string
  // hidden?: boolean  // uncomment if you added the "hidden" column
}

const brandEssences = [
  { key: 'cyber',      title: 'Cyber-Futuristic',  subtitle: 'Innovative, sleek, intelligent',      img: '/brand/cyber.png' },
  { key: 'industrial', title: 'Industrial',        subtitle: 'Reliable, powerful, foundational',    img: '/brand/industrial.png' },
  { key: 'core',       title: 'PGD Core Business', subtitle: 'Authentic, purposeful, sustainable',  img: '/brand/core.png' },
]

export default function Page() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  // Initialize Teams (safe outside Teams)
  useEffect(() => {
    microsoftTeams.app.initialize().catch(() => {})
  }, [])

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

  const fetchIdeas = async () => {
    try {
      const res = await fetch('/api/list', { cache: 'no-store' })
      const json = await res.json()
      setIdeas(json.items || [])
    } catch {
      // ignore
    }
  }

  const fetchMyVotes = async () => {
    try {
      const res = await fetch('/api/my-votes', { cache: 'no-store' })
      if (!res.ok) return
      const j = await res.json()
      setVotedIds(new Set<string>(j.ids || []))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchIdeas()
    fetchMyVotes()
    pollRef.current = window.setInterval(() => {
      fetchIdeas()
      fetchMyVotes()
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Temporarily bump a specific idea to the top and add a pulse effect
  const bumpAndHighlight = (id: string) => {
    setHighlightId(id)
    const el = document.getElementById(`idea-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setHighlightId(null), 2000)
  }

  // Render order: usually server order; if highlighting, move highlightId to top
  const renderIdeas = useMemo(() => {
    if (!highlightId) return ideas
    const idx = ideas.findIndex(i => i.id === highlightId)
    if (idx < 0) return ideas
    return [ideas[idx], ...ideas.slice(0, idx), ...ideas.slice(idx + 1)]
  }, [ideas, highlightId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setLoading(true)
    setErr('')
    try {
      // quick local duplicate check (server still authoritative)
      const local = ideas.find(i => normalize(i.text) === normalize(value))
      if (local) {
        setErr('Looks like someone already submitted that idea, take a look below to vote for it!')
        bumpAndHighlight(local.id)
        return
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value.slice(0, 25) }) // server enforces as well
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => ({} as any))
        setErr('Looks like someone already submitted that idea, take a look below to vote for it!')
        await fetchIdeas()
        if (body?.duplicateOf) bumpAndHighlight(body.duplicateOf)
        return
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Submit failed' }))
        throw new Error(j?.error || 'Submit failed')
      }

      setText('')
      fetchIdeas()
    } catch (e: any) {
      setErr(e?.message || 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  const vote = async (id: string) => {
    if (votedIds.has(id)) return
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) throw new Error('Vote failed')
      const next = new Set(votedIds); next.add(id); setVotedIds(next)
      // optional sync
      fetchMyVotes()
    } catch {
      alert('Vote failed. Try again shortly.')
    }
  }

  const unvote = async (id: string) => {
    if (!votedIds.has(id)) return
    try {
      const res = await fetch('/api/unvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) throw new Error('Unvote failed')
      const next = new Set(votedIds); next.delete(id); setVotedIds(next)
      // optional sync
      // fetchMyVotes()
    } catch {
      alert('Unvote failed. Try again shortly.')
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <h1 className="h1">{APP_NAME}</h1>
            <p className="sub">Submit a short, professional name aligned to one or more brand essences below.</p>
          </div>
        </div>
      </section>

      {/* Brand essences */}
      <section className="container">
        <div className="grid-3">
          {brandEssences.map(b => (
            <div key={b.key} className="essence-card">
              <div className="essence-img-wrap">
                <Image
                  src={b.img}
                  alt={b.title}
                  width={800}
                  height={800}
                  className="essence-img"
                  priority={b.key === 'cyber'}
                />
              </div>
              <div className="essence-text">
                <div className="essence-title">{b.title}</div>
                <div className="essence-sub">{b.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Submit */}
      <section className="container">
        <div className="card">
          <form onSubmit={submit} className="form-row">
            <input
              className="input"
              placeholder="Two words max • letters & numbers • 25 characters"
              value={text}
              onChange={e => {
                const v = e.target.value
                  .replace(/[^\w ]/g, '') // letters/digits/underscore/space
                  .replace(/_/g, '')      // drop underscore
                  .replace(/\s+/g, ' ')   // collapse spaces
                  .slice(0, 25)
                // at most one space => two words
                const parts = v.split(' ')
                const limited = parts.length > 2 ? parts.slice(0, 2).join(' ') : v
                setText(limited)
              }}
              maxLength={25}
            />
            <button className="button primary" disabled={!text.trim() || loading}>
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </form>
          <p className="hint small">
            Tips: keep it short, memorable, and aligned to the essences above. No emojis or punctuation.
          </p>
          {err && <div className="error">{err}</div>}
        </div>
      </section>

      {/* Ideas list (no public counts, stable order; highlight dupes briefly) */}
      <section className="container">
        <ul className="list">
          {renderIdeas.map(it => {
            const didVote = votedIds.has(it.id)
            return (
              <li
                key={it.id}
                id={`idea-${it.id}`}
                className={`idea-row ${it.id === highlightId ? 'pulse' : ''}`}
              >
                <div className="idea-text">{it.text}</div>
                <div className="idea-votes">
                  {didVote && <span className="pill pill-success">Voted</span>}
                  {didVote ? (
                    <button className="button ghost" onClick={() => unvote(it.id)}>↩︎ Unvote</button>
                  ) : (
                    <button className="button ghost" onClick={() => vote(it.id)}>👍 Vote</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
