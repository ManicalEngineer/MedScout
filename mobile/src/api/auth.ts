import { api, setToken, clearToken, BASE_URL } from './client';

export interface User {
  id: number;
  email: string;
  caregiver_mode: boolean;
  subscription_tier: 'free' | 'contributor' | 'premium';
  has_password: boolean;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  caregiver_mode: boolean;
  subscription_tier: 'free' | 'contributor' | 'premium';
}

export async function login(email: string, password: string): Promise<void> {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const data: TokenResponse = await res.json();
  await setToken(data.access_token);
}

export async function oauthLogin(provider: 'google' | 'apple', idToken: string): Promise<void> {
  const data = await api.post<TokenResponse>(
    '/auth/oauth',
    { provider, id_token: idToken },
    false,
  );
  await setToken(data.access_token);
}

export async function register(email: string, password: string): Promise<void> {
  const data = await api.post<TokenResponse>(
    '/auth/register',
    { email, password },
    false,
  );
  await setToken(data.access_token);
}

export async function logout() {
  await clearToken();
}

/** Slide the 7-day session forward. Called on app launch; failure is fine
 *  (the current token keeps working until it expires). */
export async function refreshSession(): Promise<void> {
  try {
    const data = await api.post<TokenResponse>('/auth/refresh');
    await setToken(data.access_token);
  } catch {
    // ignore — not worth interrupting the user for
  }
}

/** Invalidate every session for this account (all devices), then clear local state. */
export async function logoutAll(): Promise<void> {
  await api.post('/auth/logout-all');
  await clearToken();
}

export function getMe() {
  return api.get<User>('/users/me');
}

export function updateMe(body: { caregiver_mode?: boolean; push_token?: string }) {
  return api.patch<{ id: number; caregiver_mode: boolean }>('/users/me', body);
}

/** Permanently deletes the account and everything attached to it. */
export async function deleteAccount(password?: string): Promise<void> {
  await api.delete<void>('/users/me', { password });
  await clearToken();
}
