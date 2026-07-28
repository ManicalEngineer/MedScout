import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Status } from '../../components/Status';
import { Ring } from '../../components/Ring';
import { listRefillCountdowns, RefillCountdown } from '../../api/users';
import { listProfiles, MedicationProfile } from '../../storage/medicationProfiles';
import { listPharmacies, Pharmacy } from '../../api/pharmacies';
import { listCallLogs, CallLog } from '../../api/calls';
import { getShortageStatus, ShortageStatus } from '../../api/availability';

const STATUS_DISPLAY: Record<string, { kind: string; label: string }> = {
  in_stock: { kind: 'ok', label: 'In stock' },
  out_of_stock: { kind: 'out', label: 'Out of stock' },
  check_back: { kind: 'soon', label: 'Back soon' },
  unknown: { kind: 'muted', label: 'Unknown' },
};

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [countdown, setCountdown] = useState<RefillCountdown | null>(null);
  const [profiles, setProfiles] = useState<MedicationProfile[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [shortage, setShortage] = useState<ShortageStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const [cds, profs, pharms, logs] = await Promise.all([
        listRefillCountdowns(),
        listProfiles(),
        listPharmacies({}),
        listCallLogs(),
      ]);
      const active = profs[0];
      // Match by the active on-device profile's medication name rather than
      // just taking the first countdown row — a user can have more than one
      // (e.g. a stale row from before medication profiles moved on-device),
      // and blindly picking index 0 would show the wrong one.
      const matchedCountdown = active
        ? cds.find(c => c.medication_name === active.medication_name) ?? null
        : cds[0] ?? null;
      setCountdown(matchedCountdown);
      setProfiles(profs);
      setPharmacies(pharms);
      setCalls(logs);

      setShortage(active ? await getShortageStatus(active.medication_name).catch(() => null) : null);
    } catch { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activeProfile = profiles[0] ?? null;
  const hasCountdownData = countdown?.days_remaining != null;
  const days = countdown?.days_remaining ?? 0;
  const ringColor = days > 10 ? TOK.success : days >= 5 ? TOK.primary : TOK.danger;

  const insight = pharmacies.find(p => p.insight);
  const calledToday = calls.filter(c => {
    const d = new Date(c.called_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Yesterday';
    return `${d}d ago`;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TOK.primary} />}
    >
      {/* Shortage banner — real, medication-specific, FDA-sourced. Only shows
          when there's actually something to say, not a canned weekly message. */}
      {shortage && shortage.status !== 'available' && !bannerDismissed && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {shortage.status === 'unavailable' ? '⚠ National shortage: ' : '⚠ Limited availability: '}
          </Text>
          <Text style={styles.bannerMuted}>
            {shortage.detail || `${shortage.medication_name} is affected nationally — expect more calls than usual.`}
          </Text>
          <TouchableOpacity onPress={() => setBannerDismissed(true)} style={styles.bannerDismiss}>
            <Text style={styles.bannerDismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <Text style={styles.med}>
        {activeProfile ? `${activeProfile.medication_name} · ${activeProfile.strength}` : 'No medication set'}
      </Text>
      <Text style={styles.headline}>
        {hasCountdownData
          ? `You're ${days} ${days === 1 ? 'day' : 'days'} ahead`
          : activeProfile
            ? 'Set a refill date to track your supply'
            : "You're 0 days ahead"}
      </Text>

      {/* Ring */}
      <View style={styles.ringWrap}>
        <Ring days={days} color={ringColor} runOutDate={countdown?.run_out_date} />
      </View>

      {/* CTA */}
      <Button
        variant="primary"
        size="lg"
        onPress={() => navigation.navigate('Hunt')}
      >
        Start today's hunt
      </Button>
      <Text style={styles.stats}>
        {pharmacies.length} PHARMAC{pharmacies.length === 1 ? 'Y' : 'IES'} SAVED · {calledToday} CALLED TODAY
      </Text>

      {/* Insight card */}
      {insight && (
        <Card accent style={styles.insightCard}>
          <Text style={styles.insightLabel}>✦ INSIGHT</Text>
          <Text style={styles.insightText}>{insight.insight}</Text>
        </Card>
      )}

      {/* Recent calls */}
      {calls.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>RECENT CALLS</Text>
          <Card style={{ padding: 0 }}>
            {calls.slice(0, 9).map((c, i) => {
              const s = STATUS_DISPLAY[c.status] ?? { kind: 'muted', label: c.status };
              const pharm = pharmacies.find(p => p.id === c.pharmacy_id);
              return (
                <View
                  key={c.id}
                  style={[styles.callRow, i < Math.min(calls.length, 9) - 1 && styles.callRowBorder]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.callName}>{pharm?.name ?? `Pharmacy #${c.pharmacy_id}`}</Text>
                    <Text style={styles.callTime}>{formatRelative(c.called_at)}</Text>
                  </View>
                  <Status kind={s.kind} label={s.label} />
                </View>
              );
            })}
          </Card>
        </>
      )}

      {calls.length === 0 && pharmacies.length === 0 && (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Ready to hunt?</Text>
          <Text style={styles.emptyBody}>Add pharmacies in the Hunt tab to get started.</Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('Hunt')}
            style={{ marginTop: 12 }}
          >
            Go to Hunt
          </Button>
        </Card>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  content: { padding: 16, paddingTop: 16, gap: 0, paddingBottom: 20 },
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    backgroundColor: TOK.dangerDim,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, padding: 10, marginBottom: 16, gap: 0,
  },
  bannerText: { fontSize: 12, color: TOK.text, fontWeight: '600' },
  bannerMuted: { fontSize: 12, color: TOK.textMuted, flex: 1 },
  bannerDismiss: { padding: 4 },
  bannerDismissText: { fontSize: 13, color: TOK.textMuted },
  med: { fontSize: 13, color: TOK.textMuted, marginBottom: 4 },
  headline: { fontSize: 26, fontWeight: '700', color: TOK.text, letterSpacing: -0.6, marginBottom: 16 },
  ringWrap: { alignItems: 'center', marginBottom: 18 },
  stats: { fontSize: 11, color: TOK.textDim, textAlign: 'center', letterSpacing: 0.3, marginTop: 10, marginBottom: 16 },
  insightCard: {
    backgroundColor: TOK.primaryDim,
    borderColor: 'rgba(249,115,22,0.4)',
    marginBottom: 20,
    marginTop: 4,
  },
  insightLabel: {
    fontSize: 11, color: TOK.primary, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6,
  },
  insightText: { fontSize: 14, lineHeight: 20, color: TOK.text },
  sectionLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  callRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  callRowBorder: { borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft },
  callName: { fontSize: 14, fontWeight: '500', color: TOK.text },
  callTime: { fontSize: 11, color: TOK.textMuted, marginTop: 2 },
  emptyCard: { marginTop: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TOK.text, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: TOK.textMuted, textAlign: 'center' },
});
