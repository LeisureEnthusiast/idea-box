import { NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAnon
    .from('ideas')
    .select('id,text,votes,created_at,hidden')
    .order('created_at', { ascending: false })   // 👈 no vote-based sorting
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: (data || []).filter(i => (i as any).hidden !== true) })
}
