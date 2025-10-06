import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

const ALLOWED = /^[A-Za-z0-9]+(?: [A-Za-z0-9]+)?$/  // one optional space
const MAX_LEN = 25

function deburr(s: string) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function normalizeLeet(s: string) {
  return s
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/0/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
}

function normalizeForCheck(s: string) {
  return normalizeLeet(deburr(s)).toLowerCase()
}

function loadBlocklist(): string[] {
  const raw = process.env.BAD_WORDS || ''
  return raw
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(Boolean)
}

const BAD = new Set(loadBlocklist())

function isProfane(text: string) {
  // token-level check; also substring fallback for simple cases
  const t = normalizeForCheck(text).replace(/[^a-z0-9 ]/g, ' ')
  const tokens = t.split(' ').filter(Boolean)
  for (const tok of tokens) {
    if (BAD.has(tok)) return true
  }
  const joined = tokens.join('')
  for (const word of BAD) {
    if (word.length >= 3 && (joined.includes(word) || t.includes(word))) return true
  }
  return false
}

function normalizeIdeaInput(s: string) {
  let x = normalizeSpaces(s)
  // collapse to letters/digits + one space (client can be lenient; server is strict)
  if (x.length > MAX_LEN) x = x.slice(0, MAX_LEN)
  return x
}

function normalizeKey(s: string) {
  // used only for quick duplicate query (DB has text_norm anyway)
  return normalizeSpaces(s).toLowerCase()
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    const raw = (text || '').toString()
    const clean = normalizeIdeaInput(raw)

    if (!clean) return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    if (clean.length > MAX_LEN) {
      return NextResponse.json({ error: `Max ${MAX_LEN} characters.` }, { status: 400 })
    }
    if (!ALLOWED.test(clean)) {
      return NextResponse.json({ error: 'Use letters/numbers with at most one space (two words max). No emojis or punctuation.' }, { status: 400 })
    }
    if (isProfane(clean)) {
      return NextResponse.json({ error: 'Please choose a different, professional name.' }, { status: 400 })
    }

    const svc = supabaseService()

    // quick duplicate check (server-side); DB unique index also guards races
    const norm = normalizeKey(clean)
    const { data: pre, error: preErr } = await svc
      .from('ideas')
      .select('id')
      .eq('text_norm', norm)
      .limit(1)
    if (preErr) return NextResponse.json({ error: preErr.message }, { status: 500 })
    if (pre && pre.length) {
      return NextResponse.json({ duplicateOf: pre[0].id, message: 'duplicate' }, { status: 409 })
    }

    const { data, error } = await svc
      .from('ideas')
      .insert({ text: clean })   // DB constraints enforce the rules too
      .select('id')
      .single()

    if (error) {
      if (/duplicate key value/i.test(error.message)) {
        const { data: post } = await svc.from('ideas').select('id').eq('text_norm', norm).limit(1)
        return NextResponse.json({ duplicateOf: post?.[0]?.id, message: 'duplicate' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data!.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
