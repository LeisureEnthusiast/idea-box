import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    const clean = (text || '').toString().slice(0,80).trim()
    if (!clean) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

    const svc = supabaseService()
    const { error, data } = await svc.from('ideas').insert({ text: clean }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, id: data!.id })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
