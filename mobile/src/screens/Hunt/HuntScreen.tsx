import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Status } from '../../components/Status';
import { listPharmacies, Pharmacy } from '../../api/pharmacies';
import { listCallLogs, CallLog } from '../../api/calls';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HuntStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'HuntMain'>;

const STATUS_MAP: Record<string, { kind: string; label: string }> = {
  in_stock: { kind: 'ok', label: 'In stock' },
  out_of_stock: { kind: 'out', label: 'Out of stock' },
  back_soon: { kind: 'soon', label: 'Back soon' },
  unknown: { kind: 'muted', label: 'Unknown' },
};

function fillBar(rate: number) {
  const filled = Math.round(rate * 5);
  return Array.from({ length: 5 }, (_, i) => i < filled);
}

export function HuntScreen() {
  const navigation = useNavigation<Nav>();
  const [segment, setSegment] = useState<'dial' | 'log'>('dial');
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllPharms, setShowAllPharms] = useState(false);

  const load = useCallback(async () => {
    try {
      // Try to get location for proximity sort; fall back to manual if denied
      let lat: number | undefined;
      let lng: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const [pharms, logs] = await Promise.all([
        listPharmacies({ sort_by: lat != null ? 'proximity' : 'manual', lat, lng }),
        listCallLogs(),
      ]);
      setPharmacies(pharms);
      setCalls(logs);
    } catch { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const callPharmacy = (p: Pharmacy) =>
    navigation.navigate('PreFlight', { pharmacyId: p.id, pharmacyPhone: p.phone ?? '' });

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'Yesterday' : `${d}d ago`;
  };

  // Top-3: closest pharmacies that have community data, sorted by reliability
  const withReports = pharmacies.filter(p => p.community_report_count > 0);
  const top3 = [...withReports]
    .sort((a, b) => b.reliability_score - a.reliability_score)
    .slice(0, 3);
  const top3Ids = new Set(top3.map(p => p.id));
  const rest = pharmacies.filter(p => !top3Ids.has(p.id));

  const callGroups = calls.reduce<Record<string, CallLog[]>>((acc, c) => {
    const d = new Date(c.called_at).toDateString();
    acc[d] = [...(acc[d] ?? []), c];
    return acc;
  }, {});

  const PharmRow = ({ p, border }: { p: Pharmacy; border: boolean }) => {
    const s = p.last_call_status ? STATUS_MAP[p.last_call_status] : null;
    return (
      <TouchableOpacity
        style={[styles.pharmRow, border && styles.pharmRowBorder]}
        onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: p.id })}
      >
        <View style={styles.flex}>
          <View style={styles.pharmNameRow}>
            {p.is_vaulted && <Text style={styles.vault}>🔒</Text>}
            <Text style={styles.pharmName}>{p.name}</Text>
          </View>
          <Text style={styles.pharmSub}>
            {p.distance_miles != null ? `${p.distance_miles}mi` : ''}
            {p.distance_miles != null && p.last_call_date ? ' · ' : ''}
            {p.last_call_date ? formatRelative(p.last_call_date) : ''}
          </Text>
          {s && <Status kind={s.kind} label={s.label} style={{ marginTop: 4 }} />}
        </View>
        <View style={styles.pharmActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => callPharmacy(p)}>
            <Text style={styles.callBtnIcon}>☎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scriptBtn}
            onPress={() => navigation.navigate('PreFlight', { pharmacyId: p.id, pharmacyPhone: p.phone ?? '' })}
          >
            <Text style={styles.scriptBtnIcon}>📋</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const RecommendedCard = ({ p }: { p: Pharmacy }) => {
    const rate = p.community_fill_rate ?? 0;
    const bars = fillBar(rate);
    const lastReport = p.last_report_at ? formatRelative(p.last_report_at) : null;
    return (
      <TouchableOpacity
        style={styles.recCard}
        onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: p.id })}
      >
        <View style={styles.recTop}>
          <View style={styles.flex}>
            <Text style={styles.recName}>{p.name}</Text>
            {p.distance_miles != null && (
              <Text style={styles.recSub}>{p.distance_miles} mi away</Text>
            )}
          </View>
          <TouchableOpacity style={styles.callBtnLg} onPress={() => callPharmacy(p)}>
            <Text style={styles.callBtnIcon}>☎</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.recBottom}>
          <View style={styles.fillBarRow}>
            {bars.map((filled, i) => (
              <View key={i} style={[styles.fillDot, filled && styles.fillDotOn]} />
            ))}
            <Text style={styles.fillLabel}>{Math.round(rate * 100)}% fill rate</Text>
          </View>
          {lastReport && (
            <Text style={styles.recMeta}>{p.community_report_count} reports · last {lastReport}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Hunt</Text>
        <Text style={styles.sub}>{pharmacies.length} saved pharmacies</Text>
        <View style={styles.segment}>
          {(['dial', 'log'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.segBtn, segment === s && styles.segBtnActive]}
              onPress={() => setSegment(s)}
            >
              <Text style={[styles.segText, segment === s && styles.segTextActive]}>
                {s === 'dial' ? 'Dialer' : 'Call Log'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TOK.primary} />}
      >
        {segment === 'dial' ? (
          <>
            {pharmacies.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No pharmacies saved</Text>
                <Text style={styles.emptySub}>Tap + to find nearby pharmacies</Text>
              </View>
            ) : (
              <>
                {/* Top-3 recommended */}
                {top3.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>BEST TO CALL</Text>
                    {top3.map(p => <RecommendedCard key={p.id} p={p} />)}
                  </>
                )}

                {/* Rest of saved list */}
                {rest.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.allToggle}
                      onPress={() => setShowAllPharms(v => !v)}
                    >
                      <Text style={styles.allToggleText}>
                        {showAllPharms ? '▾ All pharmacies' : `▸ All pharmacies (${rest.length})`}
                      </Text>
                    </TouchableOpacity>
                    {showAllPharms && (
                      <Card style={{ padding: 0 }}>
                        {rest.map((p, i) => (
                          <PharmRow key={p.id} p={p} border={i < rest.length - 1} />
                        ))}
                      </Card>
                    )}
                  </>
                )}

                {/* If no data yet, show all as flat list */}
                {top3.length === 0 && (
                  <Card style={{ padding: 0 }}>
                    {pharmacies.map((p, i) => (
                      <PharmRow key={p.id} p={p} border={i < pharmacies.length - 1} />
                    ))}
                  </Card>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {Object.entries(callGroups).map(([day, dayCalls]) => (
              <View key={day}>
                <Text style={styles.dayLabel}>
                  {new Date(day).toDateString() === new Date().toDateString() ? 'TODAY' : day.toUpperCase()}
                </Text>
                {dayCalls.map((c) => {
                  const s = STATUS_MAP[c.status] ?? { kind: 'muted', label: c.status };
                  const leftColor = c.status === 'in_stock' ? TOK.success : c.status === 'out_of_stock' ? TOK.danger : TOK.primary;
                  return (
                    <Card key={c.id} style={{ ...styles.logCard, borderLeftColor: leftColor, borderLeftWidth: 3 }}>
                      <View style={styles.logHeader}>
                        <Text style={styles.logName}>
                          {pharmacies.find(p => p.id === c.pharmacy_id)?.name ?? `Pharmacy #${c.pharmacy_id}`}
                        </Text>
                        <Text style={styles.logTime}>{formatRelative(c.called_at)}</Text>
                      </View>
                      <Status kind={s.kind} label={s.label} style={{ marginTop: 4 }} />
                    </Card>
                  );
                })}
              </View>
            ))}
            {calls.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No calls logged yet</Text>
                <Text style={styles.emptySub}>Start hunting to see your history here</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddPharmacy')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 0 },
  title: { fontSize: 30, fontWeight: '700', color: TOK.text, letterSpacing: -0.6, marginBottom: 2 },
  sub: { fontSize: 13, color: TOK.textMuted, marginBottom: 12 },
  segment: {
    flexDirection: 'row', backgroundColor: TOK.surface, borderRadius: 10,
    padding: 3, borderWidth: 1, borderColor: TOK.borderSoft, marginBottom: 12,
  },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segBtnActive: { backgroundColor: TOK.primary },
  segText: { fontSize: 13, fontWeight: '600', color: TOK.textMuted },
  segTextActive: { color: TOK.bg },
  scroll: { padding: 16, paddingBottom: 80 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: TOK.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TOK.textMuted },
  sectionLabel: {
    fontSize: 11, color: TOK.textDim, fontWeight: '600',
    letterSpacing: 0.6, marginBottom: 8,
  },
  // Recommended cards
  recCard: {
    backgroundColor: TOK.surface, borderRadius: 14, borderWidth: 1,
    borderColor: TOK.borderSoft, padding: 14, marginBottom: 10,
  },
  recTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  recName: { fontSize: 16, fontWeight: '700', color: TOK.text, marginBottom: 2 },
  recSub: { fontSize: 12, color: TOK.textMuted },
  recBottom: { gap: 4 },
  fillBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TOK.borderSoft },
  fillDotOn: { backgroundColor: TOK.primary },
  fillLabel: { fontSize: 11, color: TOK.textMuted, marginLeft: 4 },
  recMeta: { fontSize: 11, color: TOK.textDim },
  callBtnLg: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: TOK.primaryDim, borderWidth: 1, borderColor: TOK.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  // All pharmacies toggle + flat list
  allToggle: { paddingVertical: 10, marginBottom: 6 },
  allToggleText: { fontSize: 12, color: TOK.textMuted, fontWeight: '600' },
  pharmRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  pharmRowBorder: { borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft },
  pharmNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  vault: { fontSize: 12 },
  pharmName: { fontSize: 15, fontWeight: '600', color: TOK.text },
  pharmSub: { fontSize: 11, color: TOK.textMuted, marginBottom: 4 },
  pharmActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  callBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: TOK.primaryDim, borderWidth: 1, borderColor: TOK.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  callBtnIcon: { fontSize: 18, color: TOK.primary },
  scriptBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: TOK.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scriptBtnIcon: { fontSize: 18 },
  dayLabel: {
    fontSize: 11, color: TOK.textDim, fontWeight: '600',
    letterSpacing: 0.6, marginTop: 12, marginBottom: 8,
  },
  logCard: { marginBottom: 8, borderRadius: 14, padding: 14 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logName: { fontSize: 14, fontWeight: '600', color: TOK.text },
  logTime: { fontSize: 11, color: TOK.textDim },
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: TOK.bg, borderWidth: 1.5, borderColor: TOK.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: TOK.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 26, color: TOK.primary, lineHeight: 30 },
});
