// Small on-device "have we already done X" flags — walkthrough seen, and
// whether this is the account's first-ever app session (used to gate the
// review prompt, which must never fire on first launch). Same per-account
// SecureStore pattern as medicationProfiles.ts, kept in its own file since
// these aren't medication data.
import * as SecureStore from 'expo-secure-store';

let activeUserId: number | null = null;

function keyFor(userId: number, flag: string): string {
  return `device_flag_${flag}_${userId}`;
}

/** Call whenever the signed-in user changes (including to null on sign out) — same pattern as medicationProfiles.setActiveUserId. */
export function setActiveUserId(userId: number | null): void {
  activeUserId = userId;
}

async function getFlag(flag: string): Promise<boolean> {
  if (activeUserId === null) return false;
  return (await SecureStore.getItemAsync(keyFor(activeUserId, flag))) === 'true';
}

async function setFlag(flag: string): Promise<void> {
  if (activeUserId === null) return;
  await SecureStore.setItemAsync(keyFor(activeUserId, flag), 'true');
}

export async function hasSeenWalkthrough(): Promise<boolean> {
  return getFlag('walkthrough_seen');
}

export async function markWalkthroughSeen(): Promise<void> {
  await setFlag('walkthrough_seen');
}

// Deliberately split read/write (rather than one read-and-mark call) so
// callers can cache the read for the lifetime of the session instead of
// re-querying storage — a read-and-mark-in-one function would flip to
// "not first session" the moment anything called it a second time in the
// same session, which is exactly the bug this would otherwise invite.
export async function isFirstSessionEver(): Promise<boolean> {
  return !(await getFlag('first_session_done'));
}

export async function markFirstSessionDone(): Promise<void> {
  await setFlag('first_session_done');
}
