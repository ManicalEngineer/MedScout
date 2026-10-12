import { api } from '../api/client';

// Every other Loops lifecycle event (first_report_submitted,
// contributor_milestone, user_onboarded, pharmacy_search_completed) fires
// server-side from the backend code path that already knows it happened —
// see backend/loops.py. app_opened_no_action is the one exception: a pure
// client-side inactivity timer with no server-observable trigger, so it's
// the only event this app reports directly, via the authenticated
// /analytics/track proxy (keeps LOOPS_API_KEY out of the app binary).
type ClientEventName = 'app_opened_no_action';

export function trackEvent(
  eventName: ClientEventName,
  eventProperties: Record<string, unknown> = {},
): void {
  api
    .post<void>('/analytics/track', { event_name: eventName, event_properties: eventProperties })
    .catch((err) => {
      if (__DEV__) console.warn('[loops] trackEvent failed', eventName, err);
    });
}
