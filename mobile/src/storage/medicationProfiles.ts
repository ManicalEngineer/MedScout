// Medication profiles live on-device only — the backend has no business need
// for this data and never sees the full profile (see api/users.ts for the
// slim medication_name/strength fields that *do* sync server-side, purely to
// support restock alerts and the FDA shortage tracker). The tradeoff: this
// data doesn't survive a phone change — an accepted cost for keeping it off
// the server.
import * as SecureStore from 'expo-secure-store';
import { trackMedication, unsubscribeFromAlerts } from '../api/users';

const STORAGE_KEY = 'medication_profiles';

export interface MedicationProfile {
  id: string;
  medication_name: string;
  strength: string;
  formulation?: string;
  is_child_profile: boolean;
  child_name?: string;
}

async function readAll(): Promise<MedicationProfile[]> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(profiles: MedicationProfile[]): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profiles));
}

export async function listProfiles(): Promise<MedicationProfile[]> {
  return readAll();
}

/** The most recently added profile — mirrors the old server behavior of
 * treating the first active profile as "the" active one. */
export async function getActiveProfile(): Promise<MedicationProfile | null> {
  const profiles = await readAll();
  return profiles[0] ?? null;
}

// Fire-and-forget, anonymous — no user reference is stored server-side, this
// purely tells the backend "someone tracks this medication" for FDA
// shortage-status coverage. Never blocks the local write or surfaces an
// error if the network's unavailable. This is deliberately the *only*
// automatic server sync a profile create triggers — restock alerts are a
// separate, explicit, consented opt-in per medication (see api/users.ts
// subscribeToAlerts and the toggle in ProfileScreen), never automatic.
function syncTrackedMedication(profile: MedicationProfile) {
  trackMedication({
    medication_name: profile.medication_name,
    strength: profile.strength,
  }).catch(() => {});
}

export async function createProfile(input: {
  medication_name: string;
  strength: string;
  formulation?: string;
  is_child_profile?: boolean;
  child_name?: string;
}): Promise<MedicationProfile> {
  const profile: MedicationProfile = {
    id: `${Date.now()}`,
    is_child_profile: false,
    ...input,
  };
  const profiles = await readAll();
  profiles.unshift(profile);
  await writeAll(profiles);
  syncTrackedMedication(profile);
  return profile;
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = await readAll();
  const removed = profiles.find(p => p.id === id);
  await writeAll(profiles.filter(p => p.id !== id));
  // If you stop tracking a medication, drop any restock-alert subscription
  // for it too rather than leaving an orphaned link on the server.
  if (removed) {
    unsubscribeFromAlerts(removed.medication_name, removed.strength).catch(() => {});
  }
}
