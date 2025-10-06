'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'

const APP_NAME = 'PGD Copilot — Renaming Ideas' // header rename

type Idea = { id: string; text: string; votes: number; created_at: string }

const brandEssences = [
  {
    key: 'cyber',
    title: 'Cyber-Futuristic',
    subtitle: 'Innovative, sleek, intelligent',
    img: '/brand/cyber.jpg'
  },
  {
    key: 'industrial',
    title: 'Industrial',
    subtitle: 'Reliable, powerful, foundational',
    img: '/brand/industrial.jpg'
  },
  {
    key: 'core',
    title: 'PGD Core Business',
    subtitle: 'Authentic, purposeful, sustainable',
    img: '/brand/core.jpg'
  },
]

export default function Page() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const pollRef = useRef<number | null>(null)

  // Initialize Teams (safe outside Teams, just ignores)
  useEffect(() => {
    microsoftTeams.app.initialize().catch(() => {})
  }, [])

  const fetchIdeas = async () => {
    const res = await fetch('/api/list', { cache: 'no-store' })
    const json = await res.json()
    setIdeas(json.items || [])
  }

  useEffect(() => {
    fetchIdeas()
    pollRef.current = window.setInterval(fetchIdeas, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const sorted = useMemo(() => [...ideas].sort((a,b)=> (b.votes||0)-(a.votes||0)), [ideas])

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setLoading(true)
    setErr('')
    try {
      // quick client-side duplicate check (server still authoritative)
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
        body: JSON.stringify({ text: value.slice(0, 25) }) // 25-char cap (server enforces too)
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        setErr("Looks like someone already submitted that idea, take a look below to vote for it!")
        await fetchIdeas()
        const id = body?.duplicateOf
        if (id) setTimeout(() => {
          document.getElementById(`idea-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        return
      }

      if (!res.ok) {
        const j = await res.json().catch(()=>({error:'Submit failed'}))
        throw new Error(j?.error || 'Submit failed')
      }

      setText('')
      fetchIdeas()
    } catch (e:any) {
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
        body: JSON.stringify({ id })
      })
      if (!res.ok) throw new Error('Vote failed')
      fetchIdeas()
    } catch {
      alert('Vote failed. Try again shortly.')
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
                <img src={b.img} alt={b.title} className="essence-img" />
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
                // enforce one space => two words max
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
            Tips: keep it short, memorable, and aligned to one or more essences above. No emojis or punctuation.
          </p>
          {err && <div className="error">{err}</div>}
        </div>
      </section>

      {/* Ideas list */}
      <section className="container">
        <ul className="list">
          {sorted.map(it => (
            <li key={it.id} id={`idea-${it.id}`} className="idea-row">
              <div className="idea-text">{it.text}</div>
              <div className="idea-votes">
                <span className="badge">{it.votes}</span>
                <button className="button ghost" onClick={() => vote(it.id)}>👍 Upvote</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
