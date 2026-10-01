import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const groupEmail = 'medscout-beta-testers@getmedscout.com'
const adminCredentialsPath = `${process.env.HOME ?? ''}/.hermes/medscout_admin_token.json`
const gmailCredentialsPath = `${process.env.HOME ?? ''}/.hermes/google_token.json`

type StoredGoogleCredentials = {
  client_id: string
  client_secret: string
  refresh_token: string
  token?: string
  token_uri?: string
}

async function readCredentials(path: string): Promise<StoredGoogleCredentials> {
  const credentials = JSON.parse(await readFile(path, 'utf8')) as Partial<StoredGoogleCredentials>

  if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
    throw new Error(`Invalid Google credentials file: ${path}`)
  }

  return credentials as StoredGoogleCredentials
}

function createOAuthClient(credentials: StoredGoogleCredentials) {
  const client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.token_uri,
  )

  client.setCredentials({
    access_token: credentials.token,
    refresh_token: credentials.refresh_token,
  })

  return client
}

async function addToBetaGroup(email: string) {
  const credentials = await readCredentials(adminCredentialsPath)
  const auth = createOAuthClient(credentials)
  const admin = google.admin({ version: 'directory_v1', auth })

  try {
    await admin.members.insert({
      groupKey: groupEmail,
      requestBody: { email, role: 'MEMBER' },
    })
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status !== 409) {
      throw error
    }
  }
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sendConfirmationEmail(email: string, optInUrl: string) {
  const credentials = await readCredentials(gmailCredentialsPath)
  const auth = createOAuthClient(credentials)
  const gmail = google.gmail({ version: 'v1', auth })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const sender = profile.data.emailAddress

  if (!sender) {
    throw new Error('Google account email address was not available')
  }

  const message = [
    `From: ${sender}`,
    `To: ${email}`,
    'Subject: Your MedScout Android beta access',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'Thanks for signing up for the MedScout Android beta!',
    '',
    `Join the Google Play testing program here: ${optInUrl}`,
    '',
    'Open that link with the Google account you want to use for testing, accept the invitation, and then install MedScout from Google Play.',
    '',
    'If you have any trouble joining, reply to this email for help.',
  ].join('\r\n')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeBase64Url(message) },
  })
}

export async function POST(request: NextRequest) {
  let body: { email?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Valid JSON required' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !emailPattern.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const loopsApiKey = process.env.LOOPS_API_KEY
  const optInUrl = process.env.NEXT_PUBLIC_PLAY_STORE_OPTIN_URL

  if (!loopsApiKey || !optInUrl || !process.env.HOME) {
    console.error('Android beta access is not configured')
    return NextResponse.json({ error: 'Android beta access is unavailable' }, { status: 503 })
  }

  const contactResponse = await fetch('https://app.loops.so/api/v1/contacts/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${loopsApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      source: 'landing-android-beta',
      userGroup: 'android_pending_access',
    }),
  })

  if (!contactResponse.ok && contactResponse.status !== 409) {
    const data = await contactResponse.json().catch(() => ({}))
    console.error('Loops Android beta error', contactResponse.status, data)
    return NextResponse.json({ error: 'Failed to save Android beta request' }, { status: 502 })
  }

  try {
    await addToBetaGroup(email)
  } catch (error) {
    console.error('Android beta Google Group error', error)
    return NextResponse.json({ error: 'Failed to request Android beta access' }, { status: 502 })
  }

  try {
    await sendConfirmationEmail(email, optInUrl)
  } catch (error) {
    console.error('Android beta confirmation email error', error)
    return NextResponse.json({ error: 'Failed to send Android beta confirmation' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
