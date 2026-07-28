// Medication profiles live on-device only — the backend has no business need
// for this data and never sees the full profile (see api/users.ts for the
// slim medication_name/strength fields that *do* sync server-side, purely to
// support restock alerts and the FDA shortage tracker). The tradeoff: this
// data doesn't survive a phone change — an accepted cost for keeping it off
// the server.
import * as SecureStore from 'expo-secure-store';
import { trackMedication, updateAlertSettings } from '../api/users';

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

// Fire-and-forget: neither of these should block the local write or surface
// an error to the user if the network's unavailable — they're background
// sync of the two fields the server actually needs (see api/users.ts).
function syncServerSide(profile: MedicationProfile | null) {
  trackMedication({
    medication_name: profile?.medication_name ?? '',
    strength: profile?.strength ?? '',
  }).catch(() => {});
  updateAlertSettings({
    medication_name: profile?.medication_name,
    strength: profile?.strength,
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
  syncServerSide(profile);
  return profile;
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = (await readAll()).filter(p => p.id !== id);
  await writeAll(profiles);
  syncServerSide(profiles[0] ?? null);
}
