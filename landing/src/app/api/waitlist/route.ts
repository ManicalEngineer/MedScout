import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const email: string | undefined = body?.email

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const apiKey = process.env.LOOPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Waitlist unavailable' }, { status: 503 })
  }

  const res = await fetch('https://app.loops.so/api/v1/contacts/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      source: 'landing-waitlist',
      userGroup: 'waitlist',
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    // Loops returns 409 for duplicate emails — treat as success
    if (res.status === 409) {
      return NextResponse.json({ success: true })
    }
    console.error('Loops error', res.status, data)
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
