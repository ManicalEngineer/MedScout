import { api } from './client';

export interface CallLog {
  id: number;
  pharmacy_id: number;
  pharmacy_name?: string;
  called_at: string;
  status: 'in_stock' | 'out_of_stock' | 'check_back' | 'unknown';
  contributed_to_community: boolean;
  expected_restock_date?: string | null;
  notes?: string;
  manufacturer?: string;
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
  medication_name?: string;
  strength?: string;
  expected_restock_date?: string;
  notes?: string;
}) {
  return api.post<CallLog>('/calls/', body);
}

export function getScript(params: {
  tone?: string;
  grumpy?: boolean;
  // Medication profiles live on-device only — callers read the active
  // profile from storage/medicationProfiles.ts and pass it explicitly.
  medication_name?: string;
  strength?: string;
  is_child_profile?: boolean;
  pharmacy_id?: number;
}) {
  const q = new URLSearchParams();
  if (params.tone) q.set('tone', params.tone);
  if (params.grumpy) q.set('grumpy', 'true');
  if (params.medication_name) q.set('medication_name', params.medication_name);
  if (params.strength) q.set('strength', params.strength);
  if (params.is_child_profile) q.set('is_child_profile', 'true');
  if (params.pharmacy_id != null) q.set('pharmacy_id', String(params.pharmacy_id));
  return api.get<Script>(`/scripts/?${q}`);
}
