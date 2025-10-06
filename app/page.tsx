'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Idea Box'

type Idea = { id: string; text: string; votes: number; created_at: string }

export default function Page() {
  const [ready, setReady] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    microsoftTeams.app.initialize().finally(() => setReady(true))
  }, [])

  const fetchIdeas = async () => {
    try {
      const res = await fetch('/api/list', { cache: 'no-store' })
      const json = await res.json()
      setIdeas(json.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchIdeas()
    pollRef.current = window.setInterval(fetchIdeas, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const sorted = useMemo(() => [...ideas].sort((a,b)=> (b.votes||0)-(a.votes||0)), [ideas])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim().slice(0,80) })
      })
      if (!res.ok) throw new Error('Submit failed')
      setText('')
      fetchIdeas()
    } catch (e:any) {
      setErr(e?.message || 'Submit failed')
    } finally { setLoading(false) }
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
    } catch (e) {
      alert('Vote failed. Try again shortly.')
    }
  }

  return (
    <div className="container">
      <h1 style={{margin:'8px 0'}}>{APP_NAME} — Project Name Ideas</h1>
      <p className="small">Submit an idea and upvote your favorites. No sign‑in required.</p>

      <form onSubmit={submit} style={{display:'flex', gap:8, margin:'12px 0 16px'}}>
        <input className="input" placeholder="Your idea (max 80 chars)"
               value={text} onChange={e=>setText(e.target.value)} maxLength={80} />
        <button className="button" disabled={!text.trim() || loading}>
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>
      {err && <div style={{color:'crimson', marginBottom:12}}>{err}</div>}

      <ul className="list">
        {sorted.map(it => (
          <li key={it.id} className="card">
            <div className="row">
              <div>
                <div style={{fontWeight:600}}>{it.text}</div>
                <div className="small">Votes: {it.votes}</div>
              </div>
              <button className="button" onClick={()=>vote(it.id)}>👍 Upvote</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
