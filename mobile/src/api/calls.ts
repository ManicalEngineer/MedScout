import { api } from './client';

export interface CallLog {
  id: number;
  pharmacy_id: number;
  pharmacy_name?: string;
  called_at: string;
  status: 'in_stock' | 'out_of_stock' | 'back_soon' | 'unknown';
  contributed_to_community: boolean;
}

export interface Script {
  text: string;
  all_tones: Record<string, string>;
  pharmacy?: { name: string; phone: string };
  medication_name: string;
  strength: string;
}

export function listCallLogs(pharmacyId?: number) {
  const q = pharmacyId ? `?pharmacy_id=${pharmacyId}` : '';
  return api.get<CallLog[]>(`/calls/${q}`);
}

export function logCall(body: {
  pharmacy_id: number;
  status: string;
  contribute_to_community?: boolean;
}) {
  return api.post<CallLog>('/calls/', body);
}

export function getScript(params: {
  tone?: string;
  grumpy?: boolean;
  profile_id?: number;
  pharmacy_id?: number;
}) {
  const q = new URLSearchParams();
  if (params.tone) q.set('tone', params.tone);
  if (params.grumpy) q.set('grumpy', 'true');
  if (params.profile_id != null) q.set('profile_id', String(params.profile_id));
  if (params.pharmacy_id != null) q.set('pharmacy_id', String(params.pharmacy_id));
  return api.get<Script>(`/scripts/?${q}`);
}
