
import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const t = body.t || ''
  const winnerId = body.winnerId
  const loserId = body.loserId
  const tie = !!body.tie
  const rejectBoth = !!body.rejectBoth

  if (!t) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  const svc = supabaseService()
  const { data: reviewer } = await svc.from('reviewers').select('id').eq('token', t).single()
  if (!reviewer) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  if (rejectBoth) {
    await svc.from('duel_votes').insert({
      reviewer_id: reviewer.id,
      winner_id: winnerId || loserId,
      loser_id: loserId || winnerId,
      is_tie: false,
      both_rejected: true
    })
    if (winnerId && loserId) {
      const rows = [winnerId, loserId].map(id => ({ reviewer_id: reviewer.id, idea_id: id, reason: 'neither' }))
      await svc.from('reviewer_blocks').upsert(rows, { onConflict: 'reviewer_id,idea_id' })
    }
    return NextResponse.json({ ok: true })
  }

  if (tie) {
    if (!winnerId || !loserId) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })
    await svc.from('duel_votes').insert({ reviewer_id: reviewer.id, winner_id: winnerId, loser_id: loserId, is_tie: true })
    await eloUpdate(svc, reviewer.id, winnerId, loserId, 0.5, 0.5)
    return NextResponse.json({ ok: true })
  }

  if (!winnerId || !loserId) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })
  await svc.from('duel_votes').insert({ reviewer_id: reviewer.id, winner_id: winnerId, loser_id: loserId, is_tie: false })
  await eloUpdate(svc, reviewer.id, winnerId, loserId, 1, 0)
  return NextResponse.json({ ok: true })
}

async function eloUpdate(svc, reviewerId, aId, bId, Sa, Sb) {
  const a = await fetchRating(svc, reviewerId, aId)
  const b = await fetchRating(svc, reviewerId, bId)
  const K = 24
  const Ea = 1 / (1 + 10 ** ((b.rating - a.rating) / 400))
  const Eb = 1 / (1 + 10 ** ((a.rating - b.rating) / 400))
  const Ra = a.rating + K * (Sa - Ea)
  const Rb = b.rating + K * (Sb - Eb)
  await upsert(svc, reviewerId, aId, Ra, a.games + 1)
  await upsert(svc, reviewerId, bId, Rb, b.games + 1)
}
async function fetchRating(svc, reviewerId, ideaId) {
  const { data } = await svc
    .from('reviewer_elo')
    .select('rating,games')
    .eq('reviewer_id', reviewerId)
    .eq('idea_id', ideaId)
    .single()
  return data ? { rating: Number(data.rating), games: Number(data.games) } : { rating: 1500, games: 0 }
}
async function upsert(svc, reviewerId, ideaId, rating, games) {
  const { error } = await svc
    .from('reviewer_elo')
    .upsert({ reviewer_id: reviewerId, idea_id: ideaId, rating, games }, { onConflict: 'reviewer_id,idea_id' })
  if (error) throw new Error(error.message)
}
