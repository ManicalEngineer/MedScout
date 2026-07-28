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
  radius_miles: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
}

export function getAlertSettings() {
  return api.get<AlertSettings>('/users/me/alert-settings');
}

export function updateAlertSettings(body: Partial<AlertSettings>) {
  return api.put<AlertSettings>('/users/me/alert-settings', body);
}

export interface AlertSubscription {
  medication_name: string;
  strength: string;
  consented_at: string;
}

export function listAlertSubscriptions() {
  return api.get<AlertSubscription[]>('/users/me/alert-subscriptions');
}

/** Enabling a subscription links the given medication to this account
 * server-side — callers should show the user that disclosure before
 * calling this, not just wire it straight to a toggle. */
export function subscribeToAlerts(medicationName: string, strength: string) {
  return api.post<AlertSubscription>('/users/me/alert-subscriptions', {
    medication_name: medicationName,
    strength,
  });
}

export function unsubscribeFromAlerts(medicationName: string, strength: string) {
  return api.delete<void>('/users/me/alert-subscriptions', {
    medication_name: medicationName,
    strength,
  });
}

/** Anonymous upsert feeding FDA shortage ingestion — no user reference is
 * stored server-side, this just tells the backend "someone tracks this
 * medication" so it keeps polling openFDA for it. */
export function trackMedication(body: { medication_name: string; strength: string }) {
  return api.post<void>('/users/tracked-medications', body);
}
