import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Toggle } from '../../components/Toggle';
import { ADHD_MEDS, MedicationOption, MedicationPickerFields } from '../../components/MedicationPicker';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount, updateMe } from '../../api/auth';
import {
  getRefillCountdown, updateRefillCountdown, RefillCountdown,
  getAlertSettings, updateAlertSettings, AlertSettings,
  listAlertSubscriptions, subscribeToAlerts, unsubscribeFromAlerts, AlertSubscription,
} from '../../api/users';
import { listProfiles, createProfile, MedicationProfile, deleteProfile } from '../../storage/medicationProfiles';
import {
  registerForPushNotificationsAsync, refreshPushTokenIfPermitted,
} from '../../services/pushNotifications';

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  radius_miles: 10, quiet_hours_start: 22, quiet_hours_end: 8,
};

function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profiles, setProfiles] = useState<MedicationProfile[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, RefillCountdown>>({});
  const [editingCountdown, setEditingCountdown] = useState<string | null>(null);
  const [lastFillDate, setLastFillDate] = useState('');
  const [daysSupply, setDaysSupply] = useState('30');
  const [saving, setSaving] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [subscriptions, setSubscriptions] = useState<AlertSubscription[]>([]);
  const pushSyncedRef = useRef(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // "Add another medication" modal state — mirrors OnboardingScreen's
  // controlled MedicationPickerFields usage.
  const [addingMed, setAddingMed] = useState(false);
  const [newMed, setNewMed] = useState<MedicationOption>(ADHD_MEDS[1]);
  const [newDose, setNewDose] = useState('20mg');
  const [newSupply, setNewSupply] = useState(30);
  const [newQuery, setNewQuery] = useState('');
  const [newPickerOpen, setNewPickerOpen] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const profs = await listProfiles();
      setProfiles(profs);
      const cds: Record<string, RefillCountdown> = {};
      for (const p of profs) {
        try {
          cds[p.id] = await getRefillCountdown(p.medication_name);
        } catch { /* skip */ }
      }
      setCountdowns(cds);
    } catch { /* silent */ }
    try {
      setAlertSettings(await getAlertSettings());
      setSubscriptions(await listAlertSubscriptions());
    } catch { /* silent */ }
    syncPushTokenOnce();
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isSubscribed = (p: MedicationProfile) =>
    subscriptions.some(s => s.medication_name === p.medication_name && s.strength === p.strength);

  const openAddMedication = () => {
    setNewMed(ADHD_MEDS[1]);
    setNewDose('20mg');
    setNewSupply(30);
    setNewQuery('');
    setNewPickerOpen(false);
    setAddingMed(true);
  };

  const saveNewMedication = async () => {
    setAddingSaving(true);
    try {
      const profile = await createProfile({ medication_name: newMed.brand, strength: newDose, formulation: newMed.form });
      await updateRefillCountdown(profile.medication_name, { days_supply: newSupply }).catch(() => {});
      setAddingMed(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save medication');
    } finally {
      setAddingSaving(false);
    }
  };

  const handleToggleAlert = (profile: MedicationProfile, value: boolean) => {
    if (!value) {
      setSubscriptions(s => s.filter(x => !(x.medication_name === profile.medication_name && x.strength === profile.strength)));
      unsubscribeFromAlerts(profile.medication_name, profile.strength).catch(() => load());
      return;
    }
    Alert.alert(
      `Enable alerts for ${profile.medication_name}?`,
      `This links your account to ${profile.medication_name} on our server so we can notify you when it's back in stock nearby. This is the only medication information tied to your identity — everything else stays on this device. Turn it off anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            const token = await registerForPushNotificationsAsync();
            if (!token) {
              Alert.alert(
                'Notifications disabled',
                "MedScout can't send alerts without notification permission. Enable it in Settings to get restock alerts.",
              );
              return;
            }
            await updateMe({ push_token: token }).catch(() => {});
            try {
              const sub = await subscribeToAlerts(profile.medication_name, profile.strength);
              setSubscriptions(s => [...s, sub]);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not enable alerts');
            }
          },
        },
      ],
    );
  };

  const handleDeleteProfile = (id: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'This will remove the medication profile from this device.', [
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

  const startEditCountdown = (profileId: string) => {
    const cd = countdowns[profileId];
    setEditingCountdown(profileId);
    setLastFillDate(cd?.last_fill_date ?? '');
    setDaysSupply(String(cd?.days_supply ?? 30));
  };

  const saveCountdown = async (profile: MedicationProfile) => {
    setSaving(true);
    try {
      await updateRefillCountdown(profile.medication_name, {
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, saved pharmacies, and call logs. Medication profiles stay on this device — remove them below if you want those gone too. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => setConfirmingDelete(true) },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    if (user?.has_password && !deletePassword) {
      Alert.alert('Password required', 'Enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(user?.has_password ? deletePassword : undefined);
      await signOut();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not delete account');
    } finally {
      setDeleting(false);
    }
  };

  const patchAlertSettings = async (patch: Partial<AlertSettings>) => {
    const prev = alertSettings;
    setAlertSettings(s => ({ ...s, ...patch }));
    try {
      await updateAlertSettings(patch);
    } catch (e: any) {
      setAlertSettings(prev);
      Alert.alert('Error', e.message || 'Could not update alert settings');
    }
  };

  // Runs once per app session (load() itself re-fires on every screen focus).
  // Nothing is subscribed by default anymore, so there's nothing to eagerly
  // prompt permission for — that happens contextually in handleToggleAlert
  // when the user actually turns an alert on. This just silently refreshes
  // an already-granted token (catches rotation/reinstalls) for anyone with
  // existing subscriptions.
  const syncPushTokenOnce = async () => {
    if (pushSyncedRef.current) return;
    pushSyncedRef.current = true;
    const token = await refreshPushTokenIfPermitted();
    if (token) await updateMe({ push_token: token }).catch(() => {});
  };

  const tierColor = user?.subscription_tier === 'contributor' ? TOK.primary
    : user?.subscription_tier === 'premium' ? TOK.vault : TOK.textMuted;
  const tierLabel = user?.subscription_tier === 'contributor' ? '⚡ Contributor'
    : user?.subscription_tier === 'premium' ? '⭐ Premium' : '🔓 Free';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
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
                  <Button variant="primary" size="sm" full={false} onPress={() => saveCountdown(p)} loading={saving}>
                    Save
                  </Button>
                </View>
              </View>
            )}

            <View style={[styles.alertRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: TOK.borderSoft }]}>
              <View style={styles.flex}>
                <Text style={styles.alertLabel}>Notify when back in stock</Text>
              </View>
              <Toggle
                value={isSubscribed(p)}
                onValueChange={(v) => handleToggleAlert(p, v)}
              />
            </View>
          </Card>
        );
      })}

      {profiles.length === 0 && (
        <Card>
          <Text style={styles.emptyText}>No medication profiles yet.{'\n'}Complete onboarding to add one.</Text>
        </Card>
      )}

      <Button variant="outline" size="sm" onPress={openAddMedication} style={{ marginBottom: 20 }}>
        + Add another medication
      </Button>

      {/* Alert settings — radius/quiet-hours apply to every medication
          you've subscribed to above; nothing to show with zero subscriptions. */}
      {subscriptions.length > 0 && (
      <>
      <Text style={styles.sectionLabel}>ALERT PREFERENCES</Text>
      <Card style={styles.alertCard}>
        <View style={styles.alertRow}>
              <Text style={styles.alertLabel}>Radius</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => patchAlertSettings({ radius_miles: Math.max(1, alertSettings.radius_miles - 1) })}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{alertSettings.radius_miles} mi</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => patchAlertSettings({ radius_miles: alertSettings.radius_miles + 1 })}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.alertRow, styles.alertRowBorder]}>
              <Text style={styles.alertLabel}>Quiet from</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => patchAlertSettings({ quiet_hours_start: (alertSettings.quiet_hours_start + 23) % 24 })}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{formatHour(alertSettings.quiet_hours_start)}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => patchAlertSettings({ quiet_hours_start: (alertSettings.quiet_hours_start + 1) % 24 })}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.alertRow, styles.alertRowBorder]}>
              <Text style={styles.alertLabel}>Quiet until</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => patchAlertSettings({ quiet_hours_end: (alertSettings.quiet_hours_end + 23) % 24 })}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{formatHour(alertSettings.quiet_hours_end)}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => patchAlertSettings({ quiet_hours_end: (alertSettings.quiet_hours_end + 1) % 24 })}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
      </Card>
      </>
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

      {/* Danger zone */}
      <Text style={[styles.sectionLabel, styles.dangerLabel]}>DANGER ZONE</Text>
      <Card style={styles.dangerCard}>
        {!confirmingDelete ? (
          <TouchableOpacity onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountText}>Delete account</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 10 }}>
            {user?.has_password && (
              <TextInput
                style={styles.editInput}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Enter your password"
                placeholderTextColor={TOK.textDim}
                secureTextEntry
                autoFocus
              />
            )}
            <View style={styles.editActions}>
              <Button
                variant="ghost" size="sm" full={false}
                onPress={() => { setConfirmingDelete(false); setDeletePassword(''); }}
              >
                Cancel
              </Button>
              <Button
                variant="danger" size="sm" full={false}
                onPress={confirmDeleteAccount} loading={deleting}
              >
                Confirm delete
              </Button>
            </View>
          </View>
        )}
      </Card>
    </ScrollView>

    <Modal visible={addingMed} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddingMed(false)}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setAddingMed(false)}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>ADD MEDICATION</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.flex}>
          <MedicationPickerFields
            selectedMed={newMed}
            dose={newDose}
            supply={newSupply}
            query={newQuery}
            pickerOpen={newPickerOpen}
            onOpenPicker={() => setNewPickerOpen(true)}
            onClosePicker={() => setNewPickerOpen(false)}
            onSelectMed={(m) => { setNewMed(m); setNewDose(m.doses[Math.floor(m.doses.length / 2)]); setNewPickerOpen(false); setNewQuery(''); }}
            onSelectDose={setNewDose}
            onSupplyChange={setNewSupply}
            onQueryChange={setNewQuery}
          />
        </View>
        {!newPickerOpen && (
          <Button variant="primary" size="lg" onPress={saveNewMedication} loading={addingSaving} style={{ margin: 20 }}>
            Save
          </Button>
        )}
      </SafeAreaView>
    </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  content: { padding: 16, paddingTop: 16, paddingBottom: 40 },
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
  alertCard: { marginBottom: 20 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  alertRowBorder: { borderTopWidth: 0.5, borderTopColor: TOK.borderSoft, marginTop: 8, paddingTop: 12 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: TOK.text, marginBottom: 2 },
  alertSub: { fontSize: 11, color: TOK.textMuted },
  alertLabel: { fontSize: 13, fontWeight: '500', color: TOK.text, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: TOK.surface2, borderWidth: 1, borderColor: TOK.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 16, color: TOK.text, lineHeight: 20 },
  stepperValue: { fontSize: 14, fontWeight: '600', color: TOK.text, minWidth: 44, textAlign: 'center' },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  aboutKey: { fontSize: 13, fontWeight: '500', color: TOK.textMuted, width: 70 },
  aboutVal: { fontSize: 13, color: TOK.text, flex: 1, textAlign: 'right' },
  dangerLabel: { marginTop: 20, color: TOK.danger },
  dangerCard: { borderColor: TOK.danger, borderWidth: 1 },
  deleteAccountText: { fontSize: 14, fontWeight: '600', color: TOK.danger },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  modalCancel: { fontSize: 15, color: TOK.textMuted, width: 50 },
  modalTitle: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6 },
});
