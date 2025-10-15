
import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

const SHORTLIST_MIN = Number(process.env.SHORTLIST_MIN || 25)

export async function GET(req) {
  const t = new URL(req.url).searchParams.get('t') || ''
  if (!t) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  const svc = supabaseService()

  const { data: reviewer } = await svc.from('reviewers').select('id').eq('token', t).single()
  if (!reviewer) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data: ideas, error: ideasErr } = await svc
    .from('ideas')
    .select('id,text,hidden')
    .order('created_at', { ascending: false })
  if (ideasErr) return NextResponse.json({ error: ideasErr.message }, { status: 500 })

  const { data: blocks } = await svc
    .from('reviewer_blocks')
    .select('idea_id')
    .eq('reviewer_id', reviewer.id)
  const blocked = new Set((blocks || []).map(b => b.idea_id))

  const { data: likes } = await svc
    .from('reviewer_likes')
    .select('idea_id')
    .eq('reviewer_id', reviewer.id)
  const likedSet = new Set((likes || []).map(x => x.idea_id))

  const allPool = (ideas || []).filter(i => i.hidden !== true && !blocked.has(i.id))
  if (allPool.length < 2) return NextResponse.json({ error: 'Need at least 2 ideas' }, { status: 400 })

  const likedPool = allPool.filter(i => likedSet.has(i.id))
  const unlikedPool = allPool.filter(i => !likedSet.has(i.id))

  // ratings map for rank mode
  const { data: ratings } = await svc
    .from('reviewer_elo')
    .select('idea_id,rating')
    .eq('reviewer_id', reviewer.id)
  const rmap = new Map((ratings || []).map(r => [r.idea_id, Number(r.rating)]))

  const mode = likedSet.size < SHORTLIST_MIN ? 'triage' : 'rank'
  let pair = null

  if (mode === 'triage') {
    const base = unlikedPool.length >= 2 ? unlikedPool : allPool
    const shuffled = [...base].sort(() => Math.random() - 0.5)
    pair = shuffled.slice(0, 2)
  } else {
    const pool = likedPool.length >= 2 ? likedPool : allPool
    const sub = [...pool].sort(() => Math.random() - 0.5).slice(0, 30)
    let best = null
    let gap = 1e9
    for (let i = 0; i < sub.length; i++) {
      for (let j = i + 1; j < Math.min(sub.length, i + 8); j++) {
        const a = sub[i], b = sub[j]
        const ra = rmap.get(a.id) ?? 1500, rb = rmap.get(b.id) ?? 1500
        const g = Math.abs(ra - rb)
        if (g < gap) { gap = g; best = [a, b] }
      }
    }
    pair = best || pool.slice(0, 2)
  }

  return NextResponse.json({
    left: pair[0],
    right: pair[1],
    progress: { mode, likedCount: likedSet.size, target: SHORTLIST_MIN, poolCount: allPool.length }
  })
}
