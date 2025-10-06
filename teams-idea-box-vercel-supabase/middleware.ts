import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const c = req.cookies.get('ibid')?.value
  if (!c) {
    const v = Math.random().toString(36).slice(2) + Date.now().toString(36)
    res.cookies.set('ibid', v, { httpOnly: true, sameSite: 'lax', maxAge: 60*60*24*365 })
  }
  return res
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)']
}
