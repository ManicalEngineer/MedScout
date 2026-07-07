import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
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

type Nav = NativeStackNavigationProp<HuntStackParamList, 'PostCall'>;
type Route = RouteProp<HuntStackParamList, 'PostCall'>;

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

export function PostCallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pharmacyId, audioUri } = route.params;

  const [status, setStatus] = useState('in_stock');
  const [contribute, setContribute] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editingTranscript, setEditingTranscript] = useState(false);

  const whisper = useWhisper();
  const isTranscribing = whisper.status === 'transcribing' || whisper.status === 'downloading' || whisper.status === 'loading';

  // Auto-transcribe on mount if we have an audio file
  useEffect(() => {
    if (audioUri) {
      runTranscription(audioUri);
    }
  }, []);

  const runTranscription = async (uri: string) => {
    try {
      const result = await whisper.transcribeFile(uri);
      setTranscript(result);
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
      await logCall({
        pharmacy_id: pharmacyId,
        status: effectiveStatus,
        contribute_to_community: contribute,
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log Call Result</Text>

        {/* Transcription status / result */}
        {audioUri && (
          <>
            <Text style={styles.label}>WHISPER TRANSCRIPT</Text>
            <Card accent style={styles.transcriptCard}>
              <View style={styles.transcriptHeader}>
                <Text style={styles.transcriptBadge}>🎙 Whisper tiny.en · on-device</Text>
                {!isTranscribing && transcript && (
                  <TouchableOpacity onPress={() => setEditingTranscript(e => !e)}>
                    <Text style={styles.editLink}>{editingTranscript ? 'Done' : 'Edit'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isTranscribing ? (
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

        {/* Contribute toggle */}
        <Card style={styles.contributeCard}>
          <View style={styles.contributeRow}>
            <View style={styles.flex}>
              <Text style={styles.contributeTitle}>Share with community</Text>
              <Text style={styles.contributeSub}>Anonymous. Unlocks heatmap 30 days.</Text>
            </View>
            <Toggle value={contribute} onValueChange={setContribute} />
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="success" size="lg" onPress={confirm} loading={saving || isTranscribing}>
          ✓ {isTranscribing ? 'Transcribing…' : 'Confirm & save'}
        </Button>
        <Button variant="ghost" size="md" onPress={discard} style={{ marginTop: 8 }}>
          Discard
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  scroll: { padding: 20, paddingTop: 70 },
  flex: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: TOK.text, letterSpacing: -0.4, marginBottom: 20 },
  label: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  labelDim: { opacity: 0.6 },
  transcriptCard: { marginBottom: 16 },
  transcriptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  transcriptBadge: { fontSize: 10, color: TOK.primary, fontWeight: '700', letterSpacing: 0.4 },
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
  contributeCard: { marginTop: 4 },
  contributeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contributeTitle: { fontSize: 13, fontWeight: '600', color: TOK.text, marginBottom: 2 },
  contributeSub: { fontSize: 11, color: TOK.textMuted },
  footer: { padding: 20, paddingBottom: 40 },
});
