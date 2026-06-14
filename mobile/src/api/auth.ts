import { api, setToken, clearToken } from './client';

export interface User {
  id: number;
  email: string;
  caregiver_mode: boolean;
  subscription_tier: 'free' | 'contributor' | 'premium';
}

export async function login(email: string, password: string): Promise<User> {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  await setToken(data.access_token);
  return data.user;
}

export async function register(email: string, password: string): Promise<User> {
  const data = await api.post<{ access_token: string; user: User }>(
    '/auth/register',
    { email, password },
    false,
  );
  await setToken(data.access_token);
  return data.user;
}

export async function logout() {
  await clearToken();
}

export function getMe() {
  return api.get<User>('/users/me');
}
