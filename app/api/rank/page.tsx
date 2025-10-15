
'use client'

import { useEffect, useState } from 'react'

type Idea = { id: string; text: string }
type Mode = 'triage' | 'rank'

const useToken = () =>
  new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('t') || ''

export default function RankPage() {
  const t = useToken()

  const [left, setLeft] = useState<Idea | null>(null)
  const [right, setRight] = useState<Idea | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [mode, setMode] = useState<Mode>('triage')
  const [likedCount, setLikedCount] = useState(0)
  const [target, setTarget] = useState(25)

  async function loadNext() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`/api/rank/next?t=${encodeURIComponent(t)}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Error')
      setLeft(j.left)
      setRight(j.right)
      if (j.progress) {
        setMode(j.progress.mode as Mode)
        setLikedCount(Number(j.progress.likedCount || 0))
        setTarget(Number(j.progress.target || 25))
      }
    } catch (e: any) {
      setErr(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!t) {
      setErr('Missing token. Use your personal link.')
      return
    }
    loadNext()
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') choose('L')
      if (k === 'arrowright' || k === 'l') choose('R')
      if (k === 't') choose('T') // tie
      if (k === 's') choose('S') // skip
      if (k === 'd') choose('N') // neither
      if (k === 'b') choose('B') // both good
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, left?.id, right?.id])

  async function choose(which: 'L' | 'R' | 'T' | 'S' | 'N' | 'B') {
    if (!left || !right) return
    if (which === 'S') {
      await loadNext()
      return
    }
    setLoading(true)
    try {
      if (which === 'N') {
        // Neither: block both for this reviewer
        await fetch('/api/rank/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t, winnerId: left.id, loserId: right.id, rejectBoth: true }),
        })
        await loadNext()
        return
      }

      if (which === 'B') {
        // Both good: add both to shortlist; in rank mode also log a tie to inform Elo
        await fetch('/api/rank/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t, ideaIds: [left.id, right.id] }),
        })
        if (mode === 'rank') {
          await fetch('/api/rank/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ t, winnerId: left.id, loserId: right.id, tie: true }),
          })
        }
        await loadNext()
        return
      }

      if (which === 'T') {
        await fetch('/api/rank/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t, winnerId: left.id, loserId: right.id, tie: true }),
        })
        await loadNext()
        return
      }

      // Left or Right wins
      const winnerId = which === 'L' ? left.id : right.id
      const loserId = which === 'L' ? right.id : left.id
      await fetch('/api/rank/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t, winnerId, loserId }),
      })
      await loadNext()
    } catch (e: any) {
      setErr(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '16px' }}>
      <h1 style={{ margin: '0 0 6px' }}>Rank your favorites</h1>

      <p style={{ opacity: 0.8, margin: '0 0 12px' }}>
        {mode === 'triage' ? (
          <>
            Triage: shortlist great names ({likedCount}/{target}). Keys: <b>A/←</b> left, <b>L/→</b> right,{' '}
            <b>T</b> tie, <b>S</b> skip, <b>D</b> neither, <b>B</b> both good.
          </>
        ) : (
          <>
            Ranking your shortlist. Keys: <b>A/←</b> left, <b>L/→</b> right, <b>T</b> tie, <b>S</b> skip.
          </>
        )}
      </p>

      {err && (
        <div
          style={{
            color: '#fecaca',
            background: 'rgba(239,68,68,.1)',
            border: '1px solid rgba(239,68,68,.25)',
            padding: 10,
            borderRadius: 8,
            margin: '8px 0',
          }}
        >
          {err}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 8,
        }}
      >
        {[left, right].map((card, i) => (
          <button
            key={i}
            disabled={!card || loading}
            onClick={() => choose(i === 0 ? 'L' : 'R')}
            style={{
              padding: '28px 18px',
              borderRadius: 16,
              border: '1px solid rgba(148,163,184,.2)',
              background: 'linear-gradient(180deg, rgba(15,23,42,.9), rgba(15,23,42,.7))',
              color: '#e2e8f0',
              fontSize: 22,
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 120,
            }}
          >
            {card ? card.text : '…'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <button onClick={() => choose('B')} disabled={loading || !left || !right} className="button">
          Both good
        </button>
        <button onClick={() => choose('N')} disabled={loading || !left || !right} className="button">
          Neither
        </button>
        <button onClick={() => choose('T')} disabled={loading || !left || !right} className="button">
          Tie
        </button>
        <button onClick={() => choose('S')} disabled={loading || !left || !right} className="button">
          Skip
        </button>
        <a
          href={`/api/rank/top?t=${encodeURIComponent(t)}`}
          className="button"
          style={{ textDecoration: 'none' }}
        >
          View My Top 10 (JSON)
        </a>
      </div>
    </div>
  )
}
