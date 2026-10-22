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

export type FlagReason = 'wrong_or_outdated' | 'spam' | 'abusive';

/** Flag a community report. At 3 flags from different users it's hidden for everyone. */
export function flagReport(reportId: number, reason: FlagReason) {
  return api.post<{ flagged: boolean; hidden: boolean }>(`/availability/reports/${reportId}/flag`, { reason });
}

/** Stop showing the caller any report from whoever submitted this one. */
export function hideContributorOf(reportId: number) {
  return api.post<void>(`/availability/reports/${reportId}/hide-contributor`);
}
