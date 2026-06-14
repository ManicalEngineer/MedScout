import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Toggle } from '../../components/Toggle';
import { useAuth } from '../../context/AuthContext';
import {
  listProfiles, MedicationProfile, deleteProfile,
  getRefillCountdown, updateRefillCountdown, RefillCountdown,
} from '../../api/users';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profiles, setProfiles] = useState<MedicationProfile[]>([]);
  const [countdowns, setCountdowns] = useState<Record<number, RefillCountdown>>({});
  const [editingCountdown, setEditingCountdown] = useState<number | null>(null);
  const [lastFillDate, setLastFillDate] = useState('');
  const [daysSupply, setDaysSupply] = useState('30');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const profs = await listProfiles();
      setProfiles(profs);
      const cds: Record<number, RefillCountdown> = {};
      for (const p of profs) {
        try {
          cds[p.id] = await getRefillCountdown(p.id);
        } catch { /* skip */ }
      }
      setCountdowns(cds);
    } catch { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDeleteProfile = (id: number, name: string) => {
    Alert.alert(`Remove ${name}?`, 'This will deactivate the medication profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { await deleteProfile(id); load(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const startEditCountdown = (profileId: number) => {
    const cd = countdowns[profileId];
    setEditingCountdown(profileId);
    setLastFillDate(cd?.last_fill_date ?? '');
    setDaysSupply(String(cd?.days_supply ?? 30));
  };

  const saveCountdown = async (profileId: number) => {
    setSaving(true);
    try {
      await updateRefillCountdown(profileId, {
        last_fill_date: lastFillDate || undefined,
        days_supply: parseInt(daysSupply, 10),
      });
      setEditingCountdown(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const tierColor = user?.subscription_tier === 'contributor' ? TOK.primary
    : user?.subscription_tier === 'premium' ? TOK.vault : TOK.textMuted;
  const tierLabel = user?.subscription_tier === 'contributor' ? '⚡ Contributor'
    : user?.subscription_tier === 'premium' ? '⭐ Premium' : '🔓 Free';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Account */}
      <Card style={styles.accountCard}>
        <View style={styles.accountRow}>
          <View style={styles.accountInfo}>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={[styles.tier, { color: tierColor }]}>{tierLabel}</Text>
          </View>
          <Button variant="ghost" size="sm" full={false} onPress={signOut}>
            Sign out
          </Button>
        </View>
      </Card>

      {/* Medication profiles */}
      <Text style={styles.sectionLabel}>MEDICATION PROFILES</Text>
      {profiles.map(p => {
        const cd = countdowns[p.id];
        const daysLeft = cd?.days_remaining;
        const ringColor = daysLeft == null ? TOK.textMuted
          : daysLeft > 10 ? TOK.success : daysLeft >= 5 ? TOK.primary : TOK.danger;

        return (
          <Card key={p.id} style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.flex}>
                <Text style={styles.profileName}>{p.medication_name}</Text>
                <Text style={styles.profileDetail}>{p.strength} · {p.formulation ?? ''}</Text>
                {p.is_child_profile && p.child_name && (
                  <Text style={styles.childLabel}>For {p.child_name}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleDeleteProfile(p.id, p.medication_name)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Refill countdown */}
            {cd && editingCountdown !== p.id && (
              <View style={styles.countdownRow}>
                <View style={[styles.countdownDot, { backgroundColor: ringColor }]} />
                <Text style={[styles.countdownText, { color: ringColor }]}>
                  {daysLeft != null ? `${daysLeft} days remaining` : 'No fill date set'}
                </Text>
                <TouchableOpacity onPress={() => startEditCountdown(p.id)}>
                  <Text style={styles.editBtn}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}

            {editingCountdown === p.id && (
              <View style={styles.countdownEdit}>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>LAST FILL DATE (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={lastFillDate}
                    onChangeText={setLastFillDate}
                    placeholder="2025-01-15"
                    placeholderTextColor={TOK.textDim}
                  />
                </View>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>DAYS SUPPLY</Text>
                  <TextInput
                    style={styles.editInput}
                    value={daysSupply}
                    onChangeText={setDaysSupply}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={TOK.textDim}
                  />
                </View>
                <View style={styles.editActions}>
                  <Button variant="ghost" size="sm" full={false} onPress={() => setEditingCountdown(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" full={false} onPress={() => saveCountdown(p.id)} loading={saving}>
                    Save
                  </Button>
                </View>
              </View>
            )}
          </Card>
        );
      })}

      {profiles.length === 0 && (
        <Card>
          <Text style={styles.emptyText}>No medication profiles yet.{'\n'}Complete onboarding to add one.</Text>
        </Card>
      )}

      {/* About */}
      <Text style={styles.sectionLabel}>ABOUT</Text>
      <Card>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutKey}>Privacy</Text>
          <Text style={styles.aboutVal}>Your call logs stay on device unless you contribute</Text>
        </View>
        <View style={[styles.aboutRow, { borderTopWidth: 0.5, borderTopColor: TOK.borderSoft, marginTop: 8, paddingTop: 8 }]}>
          <Text style={styles.aboutKey}>Version</Text>
          <Text style={styles.aboutVal}>1.0.0</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  content: { padding: 16, paddingTop: 70, paddingBottom: 40 },
  flex: { flex: 1 },
  accountCard: { marginBottom: 20 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountInfo: { flex: 1 },
  email: { fontSize: 15, fontWeight: '600', color: TOK.text, marginBottom: 4 },
  tier: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  profileCard: { marginBottom: 10 },
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  profileName: { fontSize: 15, fontWeight: '600', color: TOK.text },
  profileDetail: { fontSize: 12, color: TOK.textMuted, marginTop: 2 },
  childLabel: { fontSize: 11, color: TOK.vault, marginTop: 2 },
  removeBtn: { fontSize: 16, color: TOK.textDim, padding: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdownDot: { width: 8, height: 8, borderRadius: 4 },
  countdownText: { flex: 1, fontSize: 13, fontWeight: '500' },
  editBtn: { fontSize: 12, color: TOK.primary, fontWeight: '600' },
  countdownEdit: { marginTop: 8, gap: 10 },
  editField: { gap: 6 },
  editLabel: { fontSize: 10, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6 },
  editInput: {
    backgroundColor: TOK.surface2, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 8, padding: 10, fontSize: 14, color: TOK.text,
  },
  editActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  emptyText: { fontSize: 13, color: TOK.textMuted, textAlign: 'center', lineHeight: 20 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  aboutKey: { fontSize: 13, fontWeight: '500', color: TOK.textMuted, width: 70 },
  aboutVal: { fontSize: 13, color: TOK.text, flex: 1, textAlign: 'right' },
});
