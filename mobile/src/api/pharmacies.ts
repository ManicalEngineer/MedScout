import { api } from './client';

export interface Pharmacy {
  id: number;
  name: string;
  phone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  zip_code?: string;
  is_vaulted: boolean;
  sort_order: number;
  last_call_status?: string;
  last_call_date?: string;
  distance_miles?: number;
  community_fill_rate?: number;
  community_report_count: number;
  weekly_fill_rates: WeeklyFill[];
  last_report_at?: string;
  reliability_score: number;
  insight?: string;
}

export interface WeeklyFill {
  week_offset: number;
  had_stock: boolean;
  report_count: number;
}

export function listPharmacies(params: {
  sort_by?: string;
  lat?: number;
  lng?: number;
  profile_id?: number;
}) {
  const q = new URLSearchParams();
  if (params.sort_by) q.set('sort_by', params.sort_by);
  if (params.lat != null) q.set('lat', String(params.lat));
  if (params.lng != null) q.set('lng', String(params.lng));
  if (params.profile_id != null) q.set('profile_id', String(params.profile_id));
  return api.get<Pharmacy[]>(`/pharmacies/?${q}`);
}

export function createPharmacy(body: {
  name: string;
  phone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  zip_code?: string;
}) {
  return api.post<Pharmacy>('/pharmacies/', body);
}

export function updatePharmacy(id: number, body: Partial<Pharmacy>) {
  return api.patch<Pharmacy>(`/pharmacies/${id}`, body);
}

export function deletePharmacy(id: number) {
  return api.delete<void>(`/pharmacies/${id}`);
}

export function toggleVault(id: number) {
  return api.post<{ is_vaulted: boolean }>(`/pharmacies/${id}/vault`);
}

export interface NearbyCandidate {
  place_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  already_saved: boolean;
}

export function nearbyPharmacies(lat: number, lng: number) {
  return api.get<NearbyCandidate[]>(`/pharmacies/nearby?lat=${lat}&lng=${lng}`);
}

export function addPharmacyFromPlace(place_id: string, is_vaulted = false) {
  return api.post<Pharmacy>('/pharmacies/from-place', { place_id, is_vaulted });
}
