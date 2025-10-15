
import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

export async function GET(req) {
  const t = new URL(req.url).searchParams.get('t') || ''
  if (!t) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const svc = supabaseService()
  const { data: reviewer } = await svc.from('reviewers').select('id').eq('token', t).single()
  if (!reviewer) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data, error } = await svc
    .from('reviewer_elo')
    .select('idea_id,rating,games, ideas!inner(id,text,hidden)')
    .eq('reviewer_id', reviewer.id)
    .order('rating', { ascending: false })
    .limit(10)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data || [])
    .filter(r => r.ideas.hidden !== true)
    .map(r => ({ id: r.idea_id, text: r.ideas.text, rating: r.rating, games: r.games }))
  return NextResponse.json({ items })
}
