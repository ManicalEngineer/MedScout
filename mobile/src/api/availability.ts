import { api } from './client';

export interface ShortageStatus {
  medication_name: string;
  status: 'available' | 'limited' | 'unavailable';
  detail?: string;
  source: string;
  updated_at: string;
}

/** National shortage status for a medication brand (openFDA-sourced, not
 * pharmacy-specific). Returns null if nothing's been ingested for it yet. */
export function getShortageStatus(medicationName: string) {
  return api.get<ShortageStatus | null>(
    `/availability/shortage-status?medication_name=${encodeURIComponent(medicationName)}`
  );
}
