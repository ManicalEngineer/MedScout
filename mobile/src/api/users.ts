import { api } from './client';

export interface RefillCountdown {
  medication_name: string;
  last_fill_date?: string;
  days_supply: number;
  lead_time_days: number;
  push_notifications_enabled: boolean;
  days_remaining?: number;
  run_out_date?: string;
  hunt_start_date?: string;
}

export function getRefillCountdown(medicationName: string) {
  return api.get<RefillCountdown>(
    `/users/me/refill-countdown?medication_name=${encodeURIComponent(medicationName)}`
  );
}

export function updateRefillCountdown(medicationName: string, body: {
  last_fill_date?: string;
  days_supply?: number;
  lead_time_days?: number;
  push_notifications_enabled?: boolean;
}) {
  return api.put<RefillCountdown>('/users/me/refill-countdown', {
    medication_name: medicationName,
    ...body,
  });
}

export function listRefillCountdowns() {
  return api.get<RefillCountdown[]>('/users/me/refill-countdowns');
}

export interface AlertSettings {
  enabled: boolean;
  radius_miles: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  // Kept in sync with the on-device active medication profile — see
  // src/storage/medicationProfiles.ts. The server only needs these two
  // fields (not the full profile) to match restock reports against this user.
  medication_name?: string;
  strength?: string;
}

export function getAlertSettings() {
  return api.get<AlertSettings>('/users/me/alert-settings');
}

export function updateAlertSettings(body: Partial<AlertSettings>) {
  return api.put<AlertSettings>('/users/me/alert-settings', body);
}

/** Anonymous upsert feeding FDA shortage ingestion — no user reference is
 * stored server-side, this just tells the backend "someone tracks this
 * medication" so it keeps polling openFDA for it. */
export function trackMedication(body: { medication_name: string; strength: string }) {
  return api.post<void>('/users/tracked-medications', body);
}
