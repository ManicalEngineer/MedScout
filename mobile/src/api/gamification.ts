import { api } from './client';

/** A badge as returned right after it's earned. */
export interface EarnedBadge {
  key: string;
  name: string;
  description: string;
  awarded_on: string | null;
}

export interface ProgressBadge extends EarnedBadge {
  earned: boolean;
}

export interface Progress {
  gamification_enabled: boolean;
  nickname: string | null;
  contribution_count: number;
  badge_credits: number;
  streak: { current_months: number; longest_months: number; reported_this_month: boolean };
  badges: ProgressBadge[];
  next_badge: (EarnedBadge & { remaining: number }) | null;
}

export function getProgress() {
  return api.get<Progress>('/users/me/progress');
}

/** count is null when the area has too few reports to show an exact number. */
export interface AreaCount { count: number | null; fewer_than: number | null }

export interface AreaStats {
  area_code: string | null;
  area_name: string | null;
  last_30_days: AreaCount | null;
  all_time: AreaCount | null;
}

export function getAreaStats(zipCode: string) {
  return api.get<AreaStats>(`/availability/area-stats?zip_code=${encodeURIComponent(zipCode)}`);
}

export function getNicknameSuggestions() {
  return api.get<{ suggestions: string[] }>('/users/me/nickname/suggestions');
}

/** null clears the nickname. */
export function setNickname(nickname: string | null) {
  return api.put<{ nickname: string | null }>('/users/me/nickname', { nickname });
}
