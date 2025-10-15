
import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'

export async function POST(req) {
  const ok = new Headers(req.headers).get('x-mod-token') === process.env.MOD_TOKEN
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const people = Array.isArray(body.people) ? body.people : []
  const svc = supabaseService()
  const origin = new URL(req.url).origin
  const links = []

  for (const p of people) {
    const token = cryptoRandom(24)
    const { data, error } = await svc
      .from('reviewers')
      .insert({ name: p.name || null, email: p.email || null, token })
      .select('id, token')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    links.push({ ...p, url: `${origin.replace(/\/api.*/, '')}/rank?t=${data.token}` })
  }
  return NextResponse.json({ links })
}

function cryptoRandom(n) {
  const abc = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return s
}
