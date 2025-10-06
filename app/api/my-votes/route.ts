import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(req: Request) {
  try {
    const headers = new Headers(req.headers)
    const cookie = headers.get('cookie') || ''
    const ua = headers.get('user-agent') || ''

    // device fingerprint (same as vote route)
    const m = /ibid=([^;]+)/.exec(cookie)
    const seed = (m?.[1] || '') + '|' + ua
    const fingerprint = crypto.createHash('sha256').update(seed).digest('hex').slice(0,32)

    // optional: email “ticket” support, if you enabled magic links earlier
    let userId: string | null = null
    const t = /ticket=([^;]+)/.exec(cookie)?.[1]
    const svc = supabaseService()
    if (t) {
      const { data } = await svc.from('recipients').select('email').eq('token', t).single()
      if (data?.email) userId = data.email
    }

    // fetch my votes (by email OR fingerprint)
    const ids = new Set<string>()

    if (userId) {
      const { data, error } = await svc.from('votes').select('idea_id').eq('user_id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      for (const v of data || []) ids.add(v.idea_id as string)
    }

    {
      const { data, error } = await svc.from('votes').select('idea_id').eq('fingerprint', fingerprint)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      for (const v of data || []) ids.add(v.idea_id as string)
    }

    return NextResponse.json({ ids: Array.from(ids) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
