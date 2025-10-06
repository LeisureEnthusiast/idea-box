import { NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAnon
    .from('ideas')
    .select('id,text,votes,created_at')
    .order('votes', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}
