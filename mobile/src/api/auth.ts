import { api, setToken, clearToken, BASE_URL } from './client';

export interface User {
  id: number;
  email: string;
  caregiver_mode: boolean;
  subscription_tier: 'free' | 'contributor' | 'premium';
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

export function getMe() {
  return api.get<User>('/users/me');
}
