import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const { id, userId } = await req.json() as { id: string; userId?: string }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const headers = new Headers(req.headers)
    const cookie = headers.get('cookie') || ''
    const ua = headers.get('user-agent') || ''

    // same device fingerprint used in /api/vote
    const m = /ibid=([^;]+)/.exec(cookie)
    const seed = (m?.[1] || '') + '|' + ua
    const fingerprint = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32)

    const svc = supabaseService()
    // If we have a known user id (e.g., from Teams or magic-link later), remove that row
    if (userId) {
      const { error } = await svc.from('votes').delete().eq('idea_id', id).eq('user_id', userId)
      if (error && error.code !== 'PGRST116') { // ignore "no rows" style errors
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
    // Always remove any fingerprint-based vote for this idea
    {
      const { error } = await svc.from('votes').delete().eq('idea_id', id).eq('fingerprint', fingerprint)
      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // triggers will recount totals automatically
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
