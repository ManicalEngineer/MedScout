import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Status } from '../../components/Status';
import { Toggle } from '../../components/Toggle';
import { deleteAsync } from 'expo-file-system/legacy';
import { logCall } from '../../api/calls';
import { useWhisper } from '../../hooks/useWhisper';
import { HuntStackParamList } from '../../navigation/AppNavigator';
import { getActiveProfile } from '../../storage/medicationProfiles';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'PostCall'>;
type Route = RouteProp<HuntStackParamList, 'PostCall'>;

// whisper.rn only parses raw PCM WAV, and Android's MediaRecorder can't
// output that (see useCallAndRecord.ts) — so on Android every summary
// recording is AAC and transcription always fails. Skip attempting it there
// rather than surfacing a confusing "Invalid WAV file" error.
const TRANSCRIPTION_SUPPORTED = Platform.OS === 'ios';

const STATUS_OPTIONS = [
  { id: 'in_stock', label: 'In stock', kind: 'ok' },
  { id: 'out_of_stock', label: 'Out of stock', kind: 'out' },
  { id: 'check_back', label: 'Back soon', kind: 'soon' },
  { id: 'unknown', label: 'Unknown', kind: 'muted' },
];

function inferStatus(text: string): string | null {
  const lower = text.toLowerCase();
  if (/in stock|we have|yes we do|available|got it|have that/.test(lower)) return 'in_stock';
  if (/back soon|coming in|restock|thursday|friday|next week|monday|tuesday|wednesday|next shipment/.test(lower)) return 'check_back';
  if (/out of stock|don't have|not available|no stock|out of|cannot fill|can't fill/.test(lower)) return 'out_of_stock';
  return null;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Pulls a concrete restock date out of the spoken summary ("back Thursday",
// "check back tomorrow") instead of just classifying the status — pharmacists
// usually give a day, and throwing it away made every check_back report
// equally stale.
function inferRestockDate(text: string): Date | null {
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  const dayIdx = DAY_NAMES.findIndex(name => lower.includes(name));
  if (dayIdx !== -1) {
    const today = new Date();
    let delta = dayIdx - today.getDay();
    if (delta <= 0) delta += 7;
    const d = new Date();
    d.setDate(d.getDate() + delta);
    return d;
  }
  if (/next week/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }
  return null;
}

const DATE_QUICK_PICKS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function PostCallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pharmacyId, audioUri, medicationName, strength } = route.params;

  const [status, setStatus] = useState('in_stock');
  const [contribute, setContribute] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [restockDate, setRestockDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const whisper = useWhisper();
  const isTranscribing = whisper.status === 'transcribing' || whisper.status === 'downloading' || whisper.status === 'loading';

  // Auto-transcribe on mount if we have an audio file
  useEffect(() => {
    if (audioUri && TRANSCRIPTION_SUPPORTED) {
      runTranscription(audioUri);
    }
  }, []);

  const runTranscription = async (uri: string) => {
    try {
      const result = await whisper.transcribeFile(uri);
      setTranscript(result);
      const inferredDate = inferRestockDate(result);
      if (inferredDate) setRestockDate(inferredDate);
    } catch (e: any) {
      Alert.alert('Transcription failed', e.message || 'Could not transcribe audio', [
        { text: 'Continue without transcript', style: 'cancel' },
      ]);
    }
  };

  const autoStatus = transcript ? inferStatus(transcript) : null;
  const effectiveStatus = autoStatus ?? status;

  // Recordings never outlive this screen — deleted on save and on discard
  const deleteAudio = async () => {
    if (audioUri) await deleteAsync(audioUri, { idempotent: true }).catch(() => {});
  };

  const confirm = async () => {
    setSaving(true);
    try {
      // ActiveCallScreen threads through whichever medication the user
      // selected for this call (or its default). Fall back to the on-device
      // active profile only if a caller somehow skipped that (defensive,
      // shouldn't happen in the normal Hunt flow).
      let medName = medicationName;
      let medStrength = strength;
      if (!medName) {
        const activeProfile = await getActiveProfile().catch(() => null);
        medName = activeProfile?.medication_name;
        medStrength = activeProfile?.strength;
      }
      await logCall({
        pharmacy_id: pharmacyId,
        status: effectiveStatus,
        contribute_to_community: contribute,
        medication_name: medName,
        strength: medStrength,
        expected_restock_date: effectiveStatus === 'check_back' && restockDate ? toISODate(restockDate) : undefined,
        notes: notes.trim() || undefined,
      });
      await deleteAudio();
      navigation.navigate('HuntMain');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save call log');
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    await deleteAudio();
    navigation.navigate('HuntMain');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log Call Result</Text>

        {/* Transcription status / result */}
        {audioUri && (
          <>
            <Text style={styles.label}>WHISPER TRANSCRIPT</Text>
            <Card accent style={styles.transcriptCard}>
              <View style={styles.transcriptHeader}>
                <View style={styles.flex}>
                  <Text style={styles.transcriptBadge}>🎙 Whisper tiny.en · on-device</Text>
                  <Text style={styles.transcriptSub}>Your spoken summary — not a recording of the pharmacy call</Text>
                </View>
                {!isTranscribing && transcript && (
                  <TouchableOpacity onPress={() => setEditingTranscript(e => !e)}>
                    <Text style={styles.editLink}>{editingTranscript ? 'Done' : 'Edit'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!TRANSCRIPTION_SUPPORTED ? (
                <View style={styles.transcriptEmpty}>
                  <Text style={styles.transcriptEmptyText}>
                    On-device transcription isn't available on Android yet — log the outcome below.
                  </Text>
                </View>
              ) : isTranscribing ? (
                <View style={styles.transcribingRow}>
                  <ActivityIndicator color={TOK.primary} size="small" />
                  <Text style={styles.transcribingText}>
                    {whisper.status === 'downloading'
                      ? `Downloading model ${Math.round(whisper.downloadProgress * 100)}%`
                      : whisper.status === 'loading'
                        ? 'Loading model…'
                        : `Transcribing ${Math.round(whisper.transcribeProgress * 100)}%`}
                  </Text>
                </View>
              ) : transcript ? (
                editingTranscript ? (
                  <TextInput
                    style={styles.transcriptInput}
                    value={transcript}
                    onChangeText={setTranscript}
                    multiline
                    autoFocus
                    placeholderTextColor={TOK.textDim}
                  />
                ) : (
                  <Text style={styles.transcriptText}>{transcript}</Text>
                )
              ) : (
                <View style={styles.transcriptEmpty}>
                  <Text style={styles.transcriptEmptyText}>No speech detected</Text>
                  <TouchableOpacity onPress={() => runTranscription(audioUri!)}>
                    <Text style={styles.retryLink}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isTranscribing && autoStatus && (
                <View style={styles.inferredRow}>
                  <Text style={styles.inferredLabel}>Auto-detected: </Text>
                  <Status kind={autoStatus} label={STATUS_OPTIONS.find(o => o.id === autoStatus)?.label} />
                </View>
              )}
            </Card>
          </>
        )}

        {/* Outcome */}
        <Text style={[styles.label, !!autoStatus && styles.labelDim]}>
          {autoStatus ? 'OVERRIDE OUTCOME' : 'OUTCOME'}
        </Text>
        <Card style={{ padding: 0, marginBottom: 16 }}>
          {STATUS_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optRow,
                i < STATUS_OPTIONS.length - 1 && styles.optBorder,
                effectiveStatus === opt.id && styles.optActive,
              ]}
              onPress={() => setStatus(opt.id)}
            >
              <View style={[styles.radio, effectiveStatus === opt.id && styles.radioActive]}>
                {effectiveStatus === opt.id && <View style={styles.radioDot} />}
              </View>
              <Status kind={opt.kind} label={opt.label} />
              {autoStatus === opt.id && <Text style={styles.autoTag}>auto</Text>}
            </TouchableOpacity>
          ))}
        </Card>

        {/* Check-back date */}
        {effectiveStatus === 'check_back' && (
          <>
            <Text style={styles.label}>CHECK BACK</Text>
            <Card style={styles.dateCard}>
              <View style={styles.dateChipRow}>
                {DATE_QUICK_PICKS.map(pick => {
                  const pickDate = addDays(pick.days);
                  const active = !!restockDate && isSameDay(restockDate, pickDate);
                  return (
                    <TouchableOpacity
                      key={pick.label}
                      style={[styles.dateChip, active && styles.dateChipActive]}
                      onPress={() => setRestockDate(pickDate)}
                    >
                      <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{pick.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {restockDate && (
                <View style={styles.dateSummaryRow}>
                  <Text style={styles.dateSummaryText}>
                    {inferRestockDate(transcript) ? 'Auto-detected: ' : ''}{formatShortDate(restockDate)}
                  </Text>
                  <TouchableOpacity onPress={() => setRestockDate(null)}>
                    <Text style={styles.dateClearLink}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          </>
        )}

        {/* Private note */}
        <View style={styles.notesHeader}>
          <Text style={styles.label}>PRIVATE NOTE</Text>
          <Text style={styles.notesPrivacyTag}>Never shared</Text>
        </View>
        <Card style={styles.notesCard}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={t => setNotes(t.slice(0, 280))}
            placeholder="e.g. they'll hold 10 tablets, ask for the pharmacist"
            placeholderTextColor={TOK.textDim}
            multiline
          />
        </Card>

        {/* Contribute toggle */}
        <Card style={styles.contributeCard}>
          <View style={styles.contributeRow}>
            <View style={styles.flex}>
              <Text style={styles.contributeTitle}>Share with community</Text>
              <Text style={styles.contributeSub}>Anonymous. Unlocks heatmap 30 days. Your private note is never included.</Text>
            </View>
            <Toggle value={contribute} onValueChange={setContribute} />
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button testID="postcall-confirm-button" variant="success" size="lg" onPress={confirm} loading={saving || isTranscribing}>
          {isTranscribing ? '✓ Transcribing…' : '✓ Confirm & save'}
        </Button>
        <Button variant="ghost" size="md" onPress={discard} style={{ marginTop: 8 }}>
          Discard
        </Button>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  scroll: { padding: 20, paddingTop: 20 },
  flex: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: TOK.text, letterSpacing: -0.4, marginBottom: 20 },
  label: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  labelDim: { opacity: 0.6 },
  transcriptCard: { marginBottom: 16 },
  transcriptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  transcriptBadge: { fontSize: 10, color: TOK.primary, fontWeight: '700', letterSpacing: 0.4 },
  transcriptSub: { fontSize: 10, color: TOK.textDim, marginTop: 3 },
  editLink: { fontSize: 12, color: TOK.primary, fontWeight: '600' },
  transcribingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  transcribingText: { fontSize: 13, color: TOK.textMuted, flex: 1 },
  transcriptText: { fontSize: 13, color: TOK.text, lineHeight: 20 },
  transcriptInput: {
    fontSize: 13, color: TOK.text, lineHeight: 20,
    backgroundColor: TOK.surface2, borderRadius: 8,
    padding: 10, minHeight: 80, textAlignVertical: 'top',
  },
  transcriptEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  transcriptEmptyText: { fontSize: 13, color: TOK.textDim, fontStyle: 'italic', flex: 1 },
  retryLink: { fontSize: 12, color: TOK.primary, fontWeight: '600' },
  inferredRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  inferredLabel: { fontSize: 11, color: TOK.textMuted },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  optBorder: { borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft },
  optActive: { backgroundColor: 'rgba(249,115,22,0.05)' },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: TOK.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: TOK.primary },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: TOK.primary },
  autoTag: {
    fontSize: 9, fontWeight: '700', color: TOK.primary,
    backgroundColor: TOK.primaryDim, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2, letterSpacing: 0.4, marginLeft: 'auto',
  },
  dateCard: { marginBottom: 16, padding: 12 },
  dateChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TOK.border, borderRadius: 999,
  },
  dateChipActive: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  dateChipText: { fontSize: 12, fontWeight: '600', color: TOK.textMuted },
  dateChipTextActive: { color: TOK.primary },
  dateSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: TOK.borderSoft,
  },
  dateSummaryText: { fontSize: 12, color: TOK.text, fontWeight: '600' },
  dateClearLink: { fontSize: 12, color: TOK.textMuted },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  notesPrivacyTag: { fontSize: 10, color: TOK.textDim, fontWeight: '600' },
  notesCard: { marginBottom: 16, padding: 12 },
  notesInput: {
    fontSize: 13, color: TOK.text, lineHeight: 20, minHeight: 44, textAlignVertical: 'top',
  },
  contributeCard: { marginTop: 4 },
  contributeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contributeTitle: { fontSize: 13, fontWeight: '600', color: TOK.text, marginBottom: 2 },
  contributeSub: { fontSize: 11, color: TOK.textMuted },
  footer: { padding: 20, paddingBottom: 20 },
});
