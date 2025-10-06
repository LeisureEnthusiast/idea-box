import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

function normalize(s: string) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    const clean = (text || '').toString().slice(0,80).trim()
    if (!clean) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

    const norm = normalize(clean)
    const svc = supabaseService()

    // 1) Fast check — does a normalized match already exist?
    const { data: pre, error: preErr } = await svc
      .from('ideas')
      .select('id')
      .eq('text_norm', norm)
      .limit(1)
    if (preErr) return NextResponse.json({ error: preErr.message }, { status: 500 })
    if (pre && pre.length) {
      return NextResponse.json(
        { duplicateOf: pre[0].id, message: 'duplicate' },
        { status: 409 }
      )
    }

    // 2) Try to insert (unique index still guards against races)
    const { data, error } = await svc
      .from('ideas')
      .insert({ text: clean })
      .select('id')
      .single()
    if (error) {
      // If unique constraint tripped (race), look up and return 409
      if (/duplicate key value/i.test(error.message)) {
        const { data: post } = await svc
          .from('ideas')
          .select('id')
          .eq('text_norm', norm)
          .limit(1)
        return NextResponse.json(
          { duplicateOf: post?.[0]?.id, message: 'duplicate' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data!.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
