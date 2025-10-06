'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'
import Image from 'next/image'

const APP_NAME = 'PGD Copilot — Renaming Ideas'

type Idea = { id: string; text: string; votes: number; created_at: string }

const brandEssences = [
  { key: 'cyber',      title: 'Cyber-Futuristic',  subtitle: 'Innovative, sleek, intelligent',      img: '/brand/cyber.png' },
  { key: 'industrial', title: 'Industrial',        subtitle: 'Reliable, powerful, foundational',    img: '/brand/industrial.png' },
  { key: 'core',       title: 'PGD Core Business', subtitle: 'Authentic, purposeful, sustainable',  img: '/brand/core.png' },
]

// ---------- helpers ----------
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      prev = tmp
    }
  }
  return dp[n]
}
function scoreMatch(text: string, q: string) {
  const T = normalize(text), Q = normalize(q)
  if (!Q) return 0
  if (T.includes(Q)) {
    const idx = T.indexOf(Q)
    return 100 + (T.startsWith(Q) ? 30 : 0) + Math.max(0, 20 - idx) + Math.min(20, Q.length)
  }
  const tokens = T.split(' ')
  const d1 = levenshtein(T, Q)
  const d2 = Math.min(...tokens.map(tok => levenshtein(tok, Q)))
  const d = Math.min(d1, d2)
  const tol = Math.max(1, Math.floor(Q.length / 3))
  return d <= tol ? 70 - d * 5 : 0
}

export default function Page() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  // search state (separate card + its own error)
  const [q, setQ] = useState('')
  const [searchErr, setSearchErr] = useState('')
  const [suggestions, setSuggestions] = useState<Idea[]>([])
  const [sIndex, setSIndex] = useState<number>(-1)
  const suggRef = useRef<HTMLDivElement | null>(null)

  // highlight + pinning
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const pollRef = useRef<number | null>(null)

  useEffect(() => { microsoftTeams.app.initialize().catch(() => {}) }, [])

  const fetchIdeas = async () => {
    try {
      const res = await fetch('/api/list', { cache: 'no-store' })
      const json = await res.json()
      const items: Idea[] = json.items || []
      setIdeas(items)
      setPinnedIds(prev => prev.filter(id => items.some(i => i.id === id)))
    } catch {}
  }
  const fetchMyVotes = async () => {
    try {
      const res = await fetch('/api/my-votes', { cache: 'no-store' })
      if (!res.ok) return
      const j = await res.json()
      setVotedIds(new Set<string>(j.ids || []))
    } catch {}
  }
  useEffect(() => {
    fetchIdeas(); fetchMyVotes()
    pollRef.current = window.setInterval(() => { fetchIdeas(); fetchMyVotes() }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // pin + pulse
  const pin = (id: string) => setPinnedIds(prev => [id, ...prev.filter(x => x !== id)])
  const pinAndHighlight = (id: string) => {
    pin(id)
    setHighlightId(id)
    document.getElementById(`idea-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setHighlightId(null), 1600)
  }

  // render order: pinned first, then rest
  const renderIdeas = useMemo(() => {
    if (!ideas.length) return ideas
    const set = new Set(pinnedIds)
    const pinned = pinnedIds.map(id => ideas.find(i => i.id === id)).filter(Boolean) as Idea[]
    const rest = ideas.filter(i => !set.has(i.id))
    return [...pinned, ...rest]
  }, [ideas, pinnedIds])

  // suggestions
  useEffect(() => {
    setSIndex(-1)
    const query = q.trim()
    if (query.length < 2) { setSuggestions([]); return }
    const ranked = ideas
      .map(it => ({ it, score: scoreMatch(it.text, query) }))
      .filter(r => r.score > 0)
      .sort((a,b)=> b.score - a.score)
      .slice(0, 8)
      .map(r => r.it)
    setSuggestions(ranked)
  }, [q, ideas])

  const runSearch = () => {
    const query = q.trim()
    if (!query) return
    let target: Idea | undefined
    if (sIndex >= 0 && sIndex < suggestions.length) target = suggestions[sIndex]
    else if (suggestions.length) target = suggestions[0]
    else {
      const best = ideas.map(it => ({ it, score: scoreMatch(it.text, query) })).sort((a,b)=>b.score-a.score)[0]
      if (best && best.score > 0) target = best.it
    }

    if (target) {
      pinAndHighlight(target.id)
      setQ(''); setSuggestions([]); setSIndex(-1); setSearchErr('')
    } else {
      setSearchErr("Looks like that name hasn't been submitted yet, use the field above to submit")
    }
  }

  // close suggestions on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!suggRef.current) return
      if (!suggRef.current.contains(e.target as Node)) { setSuggestions([]); setSIndex(-1) }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // submit
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setLoading(true); setSubmitErr(''); setSearchErr('')
    try {
      const local = ideas.find(i => normalize(i.text) === normalize(value))
      if (local) {
        setSubmitErr('Looks like someone already submitted that idea, take a look below to vote for it!')
        pinAndHighlight(local.id)
        return
      }
      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value.slice(0, 25) })
      })
      if (res.status === 409) {
        const body = await res.json().catch(() => ({} as any))
        setSubmitErr('Looks like someone already submitted that idea, take a look below to vote for it!')
        await fetchIdeas()
        if (body?.duplicateOf) pinAndHighlight(body.duplicateOf)
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(()=>({ error: 'Submit failed' }))
        throw new Error(j?.error || 'Submit failed')
      }
      const j = await res.json().catch(() => ({} as any))
      setText(''); await fetchIdeas(); if (j?.id) pin(j.id)
    } catch (e:any) {
      setSubmitErr(e?.message || 'Submit failed')
    } finally { setLoading(false) }
  }

  // vote / unvote
  const vote = async (id: string) => {
    if (votedIds.has(id)) return
    try {
      const res = await fetch('/api/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error('Vote failed')
      const next = new Set(votedIds); next.add(id); setVotedIds(next); fetchMyVotes()
    } catch { alert('Vote failed. Try again shortly.') }
  }
  const unvote = async (id: string) => {
    if (!votedIds.has(id)) return
    try {
      const res = await fetch('/api/unvote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error('Unvote failed')
      const next = new Set(votedIds); next.delete(id); setVotedIds(next)
    } catch { alert('Unvote failed. Try again shortly.') }
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

      {/* Submit (dominant) */}
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
                const limited = parts.length > 2 ? parts.slice(0, 2).join(' ') : v
                setText(limited)
              }}
              maxLength={25}
            />
            <button className="button primary" disabled={!text.trim() || loading}>
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </form>
          <p className="hint small" style={{ marginTop: 8 }}>
            Tips: keep it short, memorable, and aligned to the essences above. No emojis or punctuation.
          </p>
          {submitErr && <div className="error">{submitErr}</div>}
        </div>
      </section>

      {/* Search (separate, less dominant) */}
      <section className="container">
        <div
          className="card"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.75), rgba(15,23,42,0.55))',
            borderColor: 'rgba(148,163,184,0.14)'
          }}
        >
          <div ref={suggRef} style={{ position: 'relative' }}>
            <div className="form-row" style={{ gap: 8 }}>
              <input
                className="input"
                placeholder="Search existing names (type to see suggestions)…"
                value={q}
                onChange={e => { setQ(e.target.value); setSearchErr('') }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSIndex(i => Math.min((i < 0 ? -1 : i) + 1, suggestions.length - 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSIndex(i => Math.max((i < 0 ? 0 : i) - 1, -1)) }
                  else if (e.key === 'Enter') { e.preventDefault(); runSearch() }
                  else if (e.key === 'Escape') { setSuggestions([]); setSIndex(-1); setQ('') }
                }}
              />
              <button className="button" onClick={runSearch} type="button">Search</button>
            </div>

            {suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute', left: 0, right: 0, zIndex: 20,
                  background: 'rgba(15,23,42,0.98)', border: '1px solid var(--border)',
                  borderRadius: 12, marginTop: 8, overflow: 'hidden',
                  boxShadow: '0 10px 24px rgba(0,0,0,0.35)'
                }}
              >
                {suggestions.map((s, idx) => (
                  <div
                    key={s.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setQ(''); setSuggestions([]); setSIndex(-1); pinAndHighlight(s.id) }}
                    onMouseEnter={() => setSIndex(idx)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: idx === sIndex ? 'rgba(96,165,250,0.12)' : 'transparent'
                    }}
                  >
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {searchErr && <div className="error" style={{ marginTop: 10 }}>{searchErr}</div>}
        </div>
      </section>

      {/* Ideas list */}
      <section className="container">
        <ul className="list">
          {renderIdeas.map(it => {
            const didVote = votedIds.has(it.id)
            return (
              <li key={it.id} id={`idea-${it.id}`} className={`idea-row ${it.id === highlightId ? 'pulse' : ''}`}>
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
