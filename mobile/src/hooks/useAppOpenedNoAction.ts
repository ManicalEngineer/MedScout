import { useCallback, useEffect, useRef } from 'react';
import { trackEvent } from '../services/loops';

const INACTIVITY_MS = 5 * 60 * 1000;

// Module-level, not per-mount: AppNavigator can remount within a single app
// session (e.g. sign-in/out flips `user`), and this should still only ever
// fire once per session.
let firedThisSession = false;

/** Starts a 5-minute timer the first time `active` becomes true (first
 * open of a session, once signed in). Fires app_opened_no_action if nothing
 * cancels it first — call the returned `markAction` from any navigation
 * state change to cancel. */
export function useAppOpenedNoAction(active: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || firedThisSession || timerRef.current) return;
    sessionStartRef.current = new Date().toISOString();
    timerRef.current = setTimeout(() => {
      firedThisSession = true;
      trackEvent('app_opened_no_action', { sessionStart: sessionStartRef.current });
    }, INACTIVITY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  return useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
}
