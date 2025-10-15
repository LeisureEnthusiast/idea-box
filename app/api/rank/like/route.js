
import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const t = body.t || ''
  const ideaIds = Array.isArray(body.ideaIds) ? body.ideaIds : []
  if (!t || ideaIds.length === 0) return NextResponse.json({ error: 'Missing token or ideas' }, { status: 400 })

  const svc = supabaseService()
  const { data: reviewer } = await svc.from('reviewers').select('id').eq('token', t).single()
  if (!reviewer) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const rows = ideaIds.map(id => ({ reviewer_id: reviewer.id, idea_id: id }))
  const { error } = await svc.from('reviewer_likes').upsert(rows, { onConflict: 'reviewer_id,idea_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
