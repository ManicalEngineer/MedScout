import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { useCallAndRecord } from '../../hooks/useCallAndRecord';
import { useWhisper } from '../../hooks/useWhisper';
import { HuntStackParamList } from '../../navigation/AppNavigator';
import { getScript } from '../../api/calls';
import { listProfiles, MedicationProfile } from '../../storage/medicationProfiles';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'ActiveCall'>;
type Route = RouteProp<HuntStackParamList, 'ActiveCall'>;

const TONES = [
  { id: 'short', label: 'Short' },
  { id: 'polite', label: 'Polite' },
  { id: 'insurance', label: 'Insurance' },
];

export function ActiveCallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pharmacyId, pharmacyName, pharmacyPhone } = route.params;

  const [elapsed, setElapsed] = useState(0);
  const [tone, setTone] = useState('polite');
  const [collapsed, setCollapsed] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [profiles, setProfiles] = useState<MedicationProfile[]>([]);
  // Defaults to the most-recently-added profile; the chip row below lets you
  // switch when there's more than one tracked medication.
  const [activeProfile, setActiveProfile] = useState<MedicationProfile | null>(null);
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const { status: callStatus, startCall, finishSummary, cancel } = useCallAndRecord({
    onCallReturned: (audioUri) => {
      navigation.replace('PostCall', {
        pharmacyId, audioUri: audioUri ?? undefined,
        medicationName: activeProfile?.medication_name, strength: activeProfile?.strength,
      });
    },
  });
  const whisper = useWhisper();

  // Only 'summarizing' has a live mic capturing something that gets saved —
  // during 'in_call' the app is backgrounded and the OS owns the mic for the
  // actual phone call, so the UI must not claim to be "recording" then.
  const isRecording = callStatus === 'recording' || callStatus === 'summarizing';
  const isOnCall = callStatus === 'in_call';

  // Pulse animation
  useEffect(() => {
    if (isRecording) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      dotOpacity.setValue(1);
    }
    return () => animRef.current?.stop();
  }, [isRecording]);

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Pre-load Whisper model silently in background — Android can't transcribe
  // its own summary recordings (see PostCallScreen's TRANSCRIPTION_SUPPORTED),
  // so don't burn 75MB of downloads there for a feature that will never run.
  useEffect(() => {
    if (Platform.OS === 'ios') whisper.prepare().catch(() => {});
  }, []);

  // Medication profiles live on-device only — load them once so the script
  // request can send name/strength/is_child_profile directly, and so a call
  // can be attributed to a specific one when more than one is tracked.
  useEffect(() => {
    listProfiles().then(profs => {
      setProfiles(profs);
      setActiveProfile(profs[0] ?? null);
    }).catch(() => {});
  }, []);

  // Load script
  useEffect(() => {
    getScript({
      tone,
      pharmacy_id: pharmacyId,
      medication_name: activeProfile?.medication_name,
      strength: activeProfile?.strength,
      is_child_profile: activeProfile?.is_child_profile,
    })
      .then(s => setScriptText(s.text))
      .catch(() => {});
  }, [tone, pharmacyId, activeProfile]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const callAndRecord = () => startCall(pharmacyPhone);

  // Skip recording entirely and go straight to logging the result.
  const skipToLog = async () => {
    if (isRecording) await cancel();
    navigation.replace('PostCall', {
      pharmacyId,
      medicationName: activeProfile?.medication_name, strength: activeProfile?.strength,
    });
  };

  const recordLabel = () => {
    if (whisper.status === 'downloading') return `↓ Downloading Whisper ${Math.round(whisper.downloadProgress * 100)}%`;
    if (whisper.status === 'loading') return '⟳ Loading model…';
    if (callStatus === 'recording') return '☎ Dialing…';
    if (callStatus === 'in_call') return "📞 On the phone — MedScout isn't listening";
    if (callStatus === 'summarizing') return '🎙 Recording your summary — speak now, then tap Done';
    return '☎ Call + Record';
  };

  const goBack = () => {
    cancel();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Pharmacy header */}
      <View style={styles.pharmInfo}>
        <View style={styles.pharmAvatar}>
          <Text style={styles.pharmAvatarIcon}>☎</Text>
        </View>
        <Text style={styles.pharmName}>{pharmacyName}</Text>
        <View style={styles.statusRow}>
          <Animated.View style={[styles.statusDot, { opacity: isOnCall ? 1 : dotOpacity, backgroundColor: isRecording ? TOK.danger : isOnCall ? TOK.textMuted : TOK.success }]} />
          <Text style={[styles.statusText, { color: isRecording ? TOK.danger : isOnCall ? TOK.textMuted : TOK.success }]}>
            {isRecording ? `Recording · ${fmt(elapsed)}` : isOnCall ? `On the phone — not recorded · ${fmt(elapsed)}` : `Ready · ${fmt(elapsed)}`}
          </Text>
        </View>
        {isOnCall && (
          <Text style={styles.onCallNote}>MedScout can't hear this part of the call. Come back here when you hang up.</Text>
        )}
      </View>

      {/* Which medication this call is about — only worth asking when
          there's more than one to choose from. */}
      {profiles.length > 1 && (
        <View style={styles.medChipRow}>
          {profiles.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.medChip, activeProfile?.id === p.id && styles.medChipActive]}
              onPress={() => setActiveProfile(p)}
            >
              <Text style={[styles.medChipText, activeProfile?.id === p.id && styles.medChipTextActive]}>
                {p.medication_name} · {p.strength}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Script card */}
      {collapsed ? (
        <TouchableOpacity style={styles.scriptPill} onPress={() => setCollapsed(false)}>
          <Text style={styles.scriptPillText}>✦ Script</Text>
        </TouchableOpacity>
      ) : (
        <Card accent style={styles.scriptCard}>
          <View style={styles.scriptCardHeader}>
            <Text style={styles.scriptLabel}>SCRIPT · TAP TO EDIT</Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              <TouchableOpacity onPress={() => getScript({
                tone, pharmacy_id: pharmacyId,
                medication_name: activeProfile?.medication_name,
                strength: activeProfile?.strength,
                is_child_profile: activeProfile?.is_child_profile,
              }).then(s => setScriptText(s.text)).catch(() => {})}>
                <Text style={styles.scriptBtn}>↻</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCollapsed(true)}>
                <Text style={styles.scriptBtn}>−</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={styles.scriptInput}
            value={scriptText}
            onChangeText={setScriptText}
            multiline
            placeholder="Script…"
            placeholderTextColor={TOK.textDim}
          />
          <View style={styles.toneRow}>
            {TONES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.toneBtn, tone === t.id && styles.toneBtnActive]}
                onPress={() => setTone(t.id)}
              >
                <Text style={[styles.toneBtnText, tone === t.id && styles.toneBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {/* Call + Record button */}
      <TouchableOpacity
        style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
        onPress={callStatus === 'idle' ? callAndRecord : undefined}
        disabled={callStatus !== 'idle'}
      >
        <Animated.View style={[styles.recordDot, { opacity: isOnCall ? 1 : dotOpacity, backgroundColor: isRecording ? TOK.danger : isOnCall ? TOK.textMuted : TOK.success }]} />
        <Text style={[styles.recordText, isRecording && styles.recordTextActive, isOnCall && styles.recordTextOnCall]}>
          {recordLabel()}
        </Text>
      </TouchableOpacity>
      {callStatus === 'idle' && (
        <Text style={styles.dialBtnSub}>
          MedScout can't record the call itself — after you hang up, you'll speak a quick summary and it gets transcribed on-device.
        </Text>
      )}

      {/* End & Log */}
      <View style={styles.endWrap}>
        <TouchableOpacity
          style={styles.endBtn}
          onPress={callStatus === 'summarizing' ? finishSummary : skipToLog}
        >
          <Text style={styles.endIcon}>{callStatus === 'summarizing' ? '✓' : '📵'}</Text>
          <Text style={styles.endLabel}>{callStatus === 'summarizing' ? 'Done — Save' : 'End & Log'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: TOK.text },
  pharmInfo: { alignItems: 'center', paddingVertical: 20 },
  pharmAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  pharmAvatarIcon: { fontSize: 34 },
  pharmName: { fontSize: 20, fontWeight: '600', color: TOK.text, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 13 },
  onCallNote: { fontSize: 11, color: TOK.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  medChipRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, marginBottom: 10,
  },
  medChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: TOK.border, borderRadius: 999,
  },
  medChipActive: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  medChipText: { fontSize: 12, fontWeight: '600', color: TOK.textMuted },
  medChipTextActive: { color: TOK.primary },
  scriptPill: {
    marginHorizontal: 14, marginBottom: 10, alignSelf: 'flex-start',
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.primary,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  scriptPillText: { color: TOK.primary, fontSize: 12, fontWeight: '600' },
  scriptCard: { marginHorizontal: 14, marginBottom: 12 },
  scriptCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scriptLabel: { fontSize: 10, color: TOK.primary, fontWeight: '700', letterSpacing: 0.6 },
  scriptBtn: { fontSize: 18, color: TOK.textMuted, paddingHorizontal: 6 },
  scriptInput: {
    fontSize: 14, lineHeight: 21, color: TOK.text, marginBottom: 10,
    minHeight: 84, textAlignVertical: 'top', padding: 0,
  },
  toneRow: { flexDirection: 'row', gap: 4 },
  toneBtn: {
    flex: 1, paddingVertical: 6, alignItems: 'center',
    borderWidth: 1, borderColor: TOK.border, borderRadius: 7,
  },
  toneBtnActive: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  toneBtnText: { fontSize: 11, fontWeight: '600', color: TOK.textMuted },
  toneBtnTextActive: { color: TOK.primary },
  dialBtn: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: TOK.primaryDim, borderWidth: 1, borderColor: TOK.primary,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  dialBtnText: { fontSize: 15, fontWeight: '600', color: TOK.primary },
  dialBtnSub: { fontSize: 10, color: TOK.textMuted, marginTop: 3 },
  recordBtn: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  recordBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderColor: TOK.danger,
  },
  recordDot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  recordText: { fontSize: 13, color: TOK.textMuted, flex: 1, fontWeight: '500' },
  recordTextActive: { color: TOK.danger },
  recordTextOnCall: { color: TOK.textMuted },
  endWrap: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  endBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: TOK.danger, alignItems: 'center', justifyContent: 'center', gap: 2,
    shadowColor: TOK.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  endIcon: { fontSize: 24 },
  endLabel: { fontSize: 9, color: '#fff', fontWeight: '600' },
});
