import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Status } from '../../components/Status';
import { listPharmacies, Pharmacy, deletePharmacy, toggleVault } from '../../api/pharmacies';
import { listCallLogs, CallLog } from '../../api/calls';
import { HuntStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'PharmacyDetail'>;
type Route = RouteProp<HuntStackParamList, 'PharmacyDetail'>;

const STATUS_MAP: Record<string, { kind: string; label: string }> = {
  in_stock: { kind: 'ok', label: 'In stock' },
  out_of_stock: { kind: 'out', label: 'Out of stock' },
  check_back: { kind: 'soon', label: 'Back soon' },
  unknown: { kind: 'muted', label: 'Unknown' },
};

export function PharmacyDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pharmacyId } = route.params;

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [pharms, logs] = await Promise.all([
        listPharmacies({}),
        listCallLogs(pharmacyId),
      ]);
      setPharmacy(pharms.find(p => p.id === pharmacyId) ?? null);
      setCalls(logs);
    } catch { /* silent */ }
  };

  const handleDelete = () => {
    Alert.alert('Remove pharmacy?', 'This will delete all call logs for this pharmacy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deletePharmacy(pharmacyId);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleToggleVault = async () => {
    try {
      const res = await toggleVault(pharmacyId);
      setPharmacy(p => p ? { ...p, is_vaulted: res.is_vaulted } : p);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (!pharmacy) return <View style={styles.root} />;

  const status = pharmacy.last_call_status ? STATUS_MAP[pharmacy.last_call_status] : null;
  const fillPct = pharmacy.community_fill_rate != null
    ? Math.round(pharmacy.community_fill_rate * 100)
    : null;

  return (
    <View style={styles.root}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.deleteText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>PHARMACY{pharmacy.distance_miles != null ? ` · ${pharmacy.distance_miles}MI` : ''}</Text>
        <Text style={styles.name}>{pharmacy.name}</Text>
        <Text style={styles.phone}>{pharmacy.phone}</Text>
        {pharmacy.address && <Text style={styles.address}>{pharmacy.address}</Text>}
        {status && <Status kind={status.kind} label={status.label} style={{ marginTop: 8, marginBottom: 16 }} />}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            variant="primary" size="md" full={false} style={styles.actionBtn}
            onPress={() => navigation.navigate('ActiveCall', {
              pharmacyId: pharmacy.id,
              pharmacyName: pharmacy.name,
              pharmacyPhone: pharmacy.phone,
            })}
          >
            ☎ Call
          </Button>
          <Button
            variant="dark" size="md" full={false} style={styles.actionBtn}
            onPress={handleToggleVault}
          >
            {pharmacy.is_vaulted ? '🔓 Unvault' : '🔒 Vault'}
          </Button>
        </View>

        {/* Community stats */}
        {fillPct != null && (
          <>
            <Text style={styles.sectionLabel}>COMMUNITY FILL RATE</Text>
            <Card style={styles.communityCard}>
              <Text style={styles.fillRate}>{fillPct}%</Text>
              <Text style={styles.fillSub}>based on {pharmacy.community_report_count} reports</Text>
              {pharmacy.insight && (
                <Text style={styles.insight}>{pharmacy.insight}</Text>
              )}
              {pharmacy.weekly_fill_rates?.length > 0 && (
                <View style={styles.weeks}>
                  {pharmacy.weekly_fill_rates.map(w => (
                    <View key={w.week_offset} style={styles.weekDot}>
                      <View style={[styles.weekIndicator, { backgroundColor: w.had_stock ? TOK.success : w.report_count > 0 ? TOK.danger : TOK.border }]} />
                      <Text style={styles.weekLabel}>Wk{w.week_offset}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        {/* Call history */}
        <Text style={styles.sectionLabel}>CALL HISTORY · {calls.length}</Text>
        {calls.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No calls logged yet</Text>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {calls.slice(0, 10).map((c, i) => {
              const s = STATUS_MAP[c.status] ?? { kind: 'muted', label: c.status };
              const dotColor = c.status === 'in_stock' ? TOK.success : c.status === 'out_of_stock' ? TOK.danger : TOK.primary;
              return (
                <View key={c.id} style={[styles.histRow, i < Math.min(calls.length, 10) - 1 && styles.histBorder]}>
                  <View style={[styles.histDot, { backgroundColor: dotColor }]} />
                  <View style={styles.flex}>
                    <Text style={styles.histDate}>{new Date(c.called_at).toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  flex: { flex: 1 },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: TOK.text },
  deleteText: { fontSize: 14, color: TOK.danger },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '700', color: TOK.text, letterSpacing: -0.4, marginBottom: 4 },
  phone: { fontSize: 14, color: TOK.textMuted },
  address: { fontSize: 12, color: TOK.textDim, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 20 },
  actionBtn: { flex: 1 },
  sectionLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  communityCard: {},
  fillRate: { fontSize: 32, fontWeight: '700', color: TOK.primary, letterSpacing: -0.5 },
  fillSub: { fontSize: 12, color: TOK.textMuted, marginTop: 2, marginBottom: 8 },
  insight: { fontSize: 13, color: TOK.text, lineHeight: 18, marginBottom: 8 },
  weeks: { flexDirection: 'row', gap: 8, marginTop: 4 },
  weekDot: { alignItems: 'center', gap: 4 },
  weekIndicator: { width: 24, height: 24, borderRadius: 4 },
  weekLabel: { fontSize: 9, color: TOK.textDim },
  histRow: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-start' },
  histBorder: { borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft },
  histDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  histDate: { fontSize: 12, color: TOK.textMuted, marginBottom: 2 },
  histNote: { fontSize: 13, color: TOK.text },
  emptyText: { fontSize: 13, color: TOK.textMuted, textAlign: 'center' },
});
