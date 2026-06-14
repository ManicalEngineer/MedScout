import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useWhisper } from '../../hooks/useWhisper';
import { HuntStackParamList } from '../../navigation/AppNavigator';
import { getScript } from '../../api/calls';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'ActiveCall'>;
type Route = RouteProp<HuntStackParamList, 'ActiveCall'>;

const TONES = [
  { id: 'short', label: 'Short' },
  { id: 'polite', label: 'Polite' },
  { id: 'insurance', label: 'Ins.' },
];

export function ActiveCallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pharmacyId, pharmacyName, pharmacyPhone } = route.params;

  const [elapsed, setElapsed] = useState(0);
  const [tone, setTone] = useState('polite');
  const [collapsed, setCollapsed] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const recorder = useAudioRecorder();
  const whisper = useWhisper();

  const isRecording = recorder.status === 'recording';

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

  // Pre-load Whisper model silently in background
  useEffect(() => {
    whisper.prepare().catch(() => {});
  }, []);

  // Load script
  useEffect(() => {
    getScript({ tone, pharmacy_id: pharmacyId })
      .then(s => setScriptText(s.text))
      .catch(() => {});
  }, [tone, pharmacyId]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const dialPhone = () => {
    const num = pharmacyPhone.replace(/\D/g, '');
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Could not open dialer', pharmacyPhone));
  };

  const toggleRecording = async () => {
    if (isRecording) {
      const fileUri = await recorder.stop();
      if (fileUri) {
        navigation.replace('PostCall', { pharmacyId, audioUri: fileUri });
      } else {
        navigation.replace('PostCall', { pharmacyId });
      }
    } else {
      try {
        await recorder.start();
      } catch (e: any) {
        Alert.alert('Recording error', e.message);
      }
    }
  };

  const endCall = async () => {
    let audioUri: string | undefined;
    if (isRecording) {
      audioUri = (await recorder.stop()) ?? undefined;
    }
    navigation.replace('PostCall', { pharmacyId, audioUri });
  };

  const recordLabel = () => {
    if (whisper.status === 'downloading') return `↓ Downloading Whisper ${Math.round(whisper.downloadProgress * 100)}%`;
    if (whisper.status === 'loading') return '⟳ Loading model…';
    if (isRecording) return `🎙 Recording ${fmt(recorder.durationMs / 1000)} — Tap to stop`;
    return '🎙 Tap to record call (speakerphone)';
  };

  return (
    <View style={styles.root}>
      {/* Pharmacy header */}
      <View style={styles.pharmInfo}>
        <View style={styles.pharmAvatar}>
          <Text style={styles.pharmAvatarIcon}>☎</Text>
        </View>
        <Text style={styles.pharmName}>{pharmacyName}</Text>
        <View style={styles.statusRow}>
          <Animated.View style={[styles.statusDot, { opacity: dotOpacity, backgroundColor: isRecording ? TOK.danger : TOK.success }]} />
          <Text style={[styles.statusText, { color: isRecording ? TOK.danger : TOK.success }]}>
            {isRecording ? `Recording · ${fmt(elapsed)}` : `Ready · ${fmt(elapsed)}`}
          </Text>
        </View>
      </View>

      {/* Script card */}
      {collapsed ? (
        <TouchableOpacity style={styles.scriptPill} onPress={() => setCollapsed(false)}>
          <Text style={styles.scriptPillText}>✦ Script</Text>
        </TouchableOpacity>
      ) : (
        <Card accent style={styles.scriptCard}>
          <View style={styles.scriptCardHeader}>
            <Text style={styles.scriptLabel}>SCRIPT</Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              <TouchableOpacity onPress={() => getScript({ tone, pharmacy_id: pharmacyId }).then(s => setScriptText(s.text)).catch(() => {})}>
                <Text style={styles.scriptBtn}>↻</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCollapsed(true)}>
                <Text style={styles.scriptBtn}>−</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.scriptText} numberOfLines={4}>"{scriptText}"</Text>
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

      {/* Dial button */}
      <TouchableOpacity style={styles.dialBtn} onPress={dialPhone}>
        <Text style={styles.dialBtnText}>☎ Dial {pharmacyPhone}</Text>
        <Text style={styles.dialBtnSub}>Put on speakerphone, then tap Record below</Text>
      </TouchableOpacity>

      {/* Record button */}
      <TouchableOpacity
        style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
        onPress={toggleRecording}
      >
        <Animated.View style={[styles.recordDot, { opacity: dotOpacity, backgroundColor: isRecording ? TOK.danger : TOK.success }]} />
        <Text style={[styles.recordText, isRecording && styles.recordTextActive]}>
          {recordLabel()}
        </Text>
      </TouchableOpacity>

      {/* End & Log */}
      <View style={styles.endWrap}>
        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
          <Text style={styles.endIcon}>📵</Text>
          <Text style={styles.endLabel}>End & Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg, paddingTop: 60 },
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
  scriptText: { fontSize: 14, lineHeight: 21, color: TOK.text, marginBottom: 10 },
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
  endWrap: { position: 'absolute', bottom: 46, left: 0, right: 0, alignItems: 'center' },
  endBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: TOK.danger, alignItems: 'center', justifyContent: 'center', gap: 2,
    shadowColor: TOK.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  endIcon: { fontSize: 24 },
  endLabel: { fontSize: 9, color: '#fff', fontWeight: '600' },
});
