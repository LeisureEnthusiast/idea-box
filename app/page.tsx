'use client'
import { useEffect, useRef, useState } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'
import Image from 'next/image'

const APP_NAME = 'PGD Copilot — Renaming Ideas'

type Idea = { id: string; text: string; votes: number; created_at: string }

const brandEssences = [
  { key: 'cyber',      title: 'Cyber-Futuristic', subtitle: 'Innovative, sleek, intelligent', img: '/brand/cyber.png' },
  { key: 'industrial', title: 'Industrial',       subtitle: 'Reliable, powerful, foundational', img: '/brand/industrial.png' },
  { key: 'core',       title: 'PGD Core Business',subtitle: 'Authentic, purposeful, sustainable', img: '/brand/core.png' },
]

export default function Page() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => { microsoftTeams.app.initialize().catch(() => {}) }, [])

  const fetchIdeas = async () => {
    const res = await fetch('/api/list', { cache: 'no-store' })
    const json = await res.json()
    setIdeas(json.items || [])
  }

  const fetchMyVotes = async () => {
    const res = await fetch('/api/my-votes', { cache: 'no-store' })
    if (res.ok) {
      const j = await res.json()
      setVotedIds(new Set(j.ids || []))
    }
  }

  useEffect(() => {
    fetchIdeas(); fetchMyVotes()
    pollRef.current = window.setInterval(() => { fetchIdeas(); fetchMyVotes() }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setLoading(true); setErr('')
    try {
      // local duplicate check (server still authoritative)
      const local = ideas.find(i => normalize(i.text) === normalize(value))
      if (local) {
        setErr("Looks like someone already submitted that idea, take a look below to vote for it!")
        document.getElementById(`idea-${local.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value.slice(0,25) })
      })

      if (res.status === 409) {
        const body = await res.json().catch(()=>({}))
        setErr("Looks like someone already submitted that idea, take a look below to vote for it!")
        await fetchIdeas()
        const id = body?.duplicateOf
        if (id) setTimeout(() =>
          document.getElementById(`idea-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
        return
      }

      if (!res.ok) {
        const j = await res.json().catch(()=>({error:'Submit failed'}))
        throw new Error(j?.error || 'Submit failed')
      }

      setText(''); fetchIdeas()
    } catch (e:any) {
      setErr(e?.message || 'Submit failed')
    } finally { setLoading(false) }
  }

  const vote = async (id: string) => {
    if (votedIds.has(id)) return
    try {
      const res = await fetch('/api/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) throw new Error('Vote failed')
      // reflect immediately
      setVotedIds(new Set([...Array.from(votedIds), id]))
      // (optional) fetch server state to stay in sync
      fetchMyVotes()
    } catch {
      alert('Vote failed. Try again shortly.')
    }
  }
  const unvote = async (id: string) => {
  try {
    const res = await fetch('/api/unvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }) // (optional) include userId here later if you wire identity
    })
    if (!res.ok) throw new Error('Unvote failed')
    // update local state instantly
    const next = new Set(votedIds)
    next.delete(id)
    setVotedIds(next)
    // (optional) refresh from server to stay in sync
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
                <Image src={b.img} alt={b.title} width={800} height={800} className="essence-img" priority={b.key==='cyber'} />
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
                  .replace(/[^\w ]/g, '').replace(/_/g, '')
                  .replace(/\s+/g, ' ').slice(0, 25)
                const parts = v.split(' ')
                const limited = parts.length > 2 ? parts.slice(0,2).join(' ') : v
                setText(limited)
              }}
              maxLength={25}
            />
            <button className="button primary" disabled={!text.trim() || loading}>
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </form>
          <p className="hint small">Tips: keep it short, memorable, and aligned to one or more essences above. No emojis or punctuation.</p>
          {err && <div className="error">{err}</div>}
        </div>
      </section>

      {/* Ideas list (no counts, no reordering by votes) */}
      <section className="container">
        <ul className="list">
          {ideas.map(it => {
            const didVote = votedIds.has(it.id)
            return (
              <li key={it.id} id={`idea-${it.id}`} className="idea-row">
                <div className="idea-text">{it.text}</div>
                <div className="idea-votes">
                  {didVote && <span className="pill pill-success">Voted</span>}
                  <button className="button ghost" disabled={didVote} onClick={() => vote(it.id)}>
                    {didVote ? 'Thanks!' : '👍 Vote'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
