import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const headers = new Headers(req.headers)
    const cookie = headers.get('cookie') || ''
    const ua = headers.get('user-agent') || ''
    const m = /ibid=([^;]+)/.exec(cookie)
    const seed = (m?.[1] || '') + '|' + ua
    const fingerprint = crypto.createHash('sha256').update(seed).digest('hex').slice(0,32)

    const svc = supabaseService()
    const { error } = await svc.from('votes').insert({ idea_id: id, fingerprint })
    if (error && !/duplicate key value/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
