import { api } from './client';

export interface MedicationProfile {
  id: number;
  medication_name: string;
  strength: string;
  formulation?: string;
  is_child_profile: boolean;
  child_name?: string;
  is_active: boolean;
}

export interface RefillCountdown {
  medication_profile_id: number;
  last_fill_date?: string;
  days_supply: number;
  lead_time_days: number;
  push_notifications_enabled: boolean;
  days_remaining?: number;
  run_out_date?: string;
  hunt_start_date?: string;
}

export function listProfiles() {
  return api.get<MedicationProfile[]>('/users/me/medication-profiles');
}

export function createProfile(body: {
  medication_name: string;
  strength: string;
  formulation?: string;
  is_child_profile?: boolean;
  child_name?: string;
}) {
  return api.post<MedicationProfile>('/users/me/medication-profiles', body);
}

export function deleteProfile(id: number) {
  return api.delete<void>(`/users/me/medication-profiles/${id}`);
}

export function getRefillCountdown(profileId: number) {
  return api.get<RefillCountdown>(`/users/me/medication-profiles/${profileId}/refill-countdown`);
}

export function updateRefillCountdown(profileId: number, body: {
  last_fill_date?: string;
  days_supply?: number;
  lead_time_days?: number;
  push_notifications_enabled?: boolean;
}) {
  return api.put<RefillCountdown>(`/users/me/medication-profiles/${profileId}/refill-countdown`, body);
}

export function listRefillCountdowns() {
  return api.get<RefillCountdown[]>('/users/me/refill-countdowns');
}
