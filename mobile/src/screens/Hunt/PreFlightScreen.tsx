import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Toggle } from '../../components/Toggle';
import { getScript, Script } from '../../api/calls';
import { listPharmacies, Pharmacy } from '../../api/pharmacies';
import { useCallAndRecord, CallRecordStatus } from '../../hooks/useCallAndRecord';
import { HuntStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'PreFlight'>;
type Route = RouteProp<HuntStackParamList, 'PreFlight'>;

const TONES = [
  { id: 'short', label: 'Short' },
  { id: 'polite', label: 'Polite' },
  { id: 'insurance', label: 'Insurance' },
];

const STATUS_LABEL: Record<CallRecordStatus, string> = {
  idle: '☎  Call + Record',
  recording: '● Recording — dial now',
  in_call: '📞 In call…',
  returning: '⏹ Saving…',
  done: '✓ Done',
  error: 'Error — try again',
};

export function PreFlightScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pharmacyId, pharmacyPhone } = route.params;

  const [tone, setTone] = useState('polite');
  const [grumpy, setGrumpy] = useState(false);
  const [script, setScript] = useState<Script | null>(null);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);

  // Pulsing dot for recording state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const { status, startCall, cancel } = useCallAndRecord({
    onCallReturned: (audioUri) => {
      navigation.navigate('PostCall', {
        pharmacyId,
        audioUri: audioUri ?? undefined,
      });
    },
  });

  useEffect(() => {
    if (status === 'recording' || status === 'in_call') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [status]);

  useEffect(() => {
    loadData();
  }, [pharmacyId, tone, grumpy]);

  const loadData = async () => {
    try {
      const [s, pharms] = await Promise.all([
        getScript({ tone, grumpy, pharmacy_id: pharmacyId }),
        listPharmacies({}),
      ]);
      setScript(s);
      setPharmacy(pharms.find(p => p.id === pharmacyId) ?? null);
    } catch { /* silent */ }
  };

  const highlightScript = (text: string) => {
    const parts = text.split(/((?:\d+mg)|(?:[A-Z][a-z]+(?:\s+XR)?(?:\s+\d+mg)?))/g);
    return parts.map((part, i) =>
      /\d+mg|XR/.test(part)
        ? <Text key={i} style={styles.highlight}>{part}</Text>
        : <Text key={i}>{part}</Text>
    );
  };

  const isActive = status === 'recording' || status === 'in_call';

  return (
    <View style={styles.root}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { cancel(); navigation.goBack(); }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.navLabel}>PRE-FLIGHT</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {pharmacy && (
          <>
            <Text style={styles.pharmName}>{pharmacy.name}</Text>
            <Text style={styles.pharmPhone}>{pharmacyPhone || pharmacy.phone}</Text>
          </>
        )}

        {/* Tone selector — hidden while call is active */}
        {!isActive && (
          <>
            <Text style={styles.label}>TONE</Text>
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
          </>
        )}

        {/* Script card */}
        <Card accent style={styles.scriptCard}>
          <View style={styles.scriptHeader}>
            <Text style={styles.scriptHeaderLabel}>✦ READ ALOUD</Text>
            {!isActive && (
              <TouchableOpacity onPress={loadData}>
                <Text style={styles.scriptAction}>↻</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.scriptText}>
            "{script ? highlightScript(script.text) : '…'}"
          </Text>
        </Card>

        {/* Grumpy toggle — hidden while call is active */}
        {!isActive && (
          <TouchableOpacity
            style={[styles.grumpyRow, grumpy && styles.grumpyRowActive]}
            onPress={() => setGrumpy(g => !g)}
          >
            <Text style={[styles.grumpyText, grumpy && styles.grumpyTextActive]}>
              ⚡ Short version
            </Text>
            <Toggle value={grumpy} onValueChange={setGrumpy} />
          </TouchableOpacity>
        )}

        {/* Recording status hint */}
        {isActive && (
          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
            <Text style={styles.statusHint}>
              {status === 'recording'
                ? 'Recording started — put on speaker, then dial'
                : status === 'in_call'
                  ? 'On call — come back when done'
                  : 'Saving recording…'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isActive ? (
          <Button variant="ghost" size="lg" onPress={cancel}>
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onPress={() => startCall(pharmacyPhone)}
            loading={status === 'returning'}
          >
            {STATUS_LABEL[status]}
          </Button>
        )}
        <Text style={styles.recordingDisclosure}>
          Recording stays on your phone, is transcribed on-device, and is deleted
          after you log the result. Recording laws vary by state — use speakerphone
          only where you have consent.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  flex: { flex: 1 },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 60, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: TOK.text },
  navLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.8 },
  scroll: { paddingHorizontal: 18, paddingBottom: 20 },
  pharmName: { fontSize: 24, fontWeight: '700', color: TOK.text, letterSpacing: -0.4, marginBottom: 4 },
  pharmPhone: { fontSize: 14, color: TOK.textMuted, marginBottom: 18 },
  label: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  toneRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  toneBtn: {
    flex: 1, paddingVertical: 10,
    borderWidth: 1, borderColor: TOK.border, borderRadius: 10,
    alignItems: 'center',
  },
  toneBtnActive: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  toneBtnText: { fontSize: 12, fontWeight: '600', color: TOK.textMuted },
  toneBtnTextActive: { color: TOK.primary },
  scriptCard: { padding: 0, marginBottom: 12 },
  scriptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 10, borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft,
  },
  scriptHeaderLabel: { fontSize: 10, color: TOK.primary, fontWeight: '700', letterSpacing: 0.8 },
  scriptAction: { fontSize: 18, color: TOK.textMuted, padding: 4 },
  scriptText: { fontSize: 17, lineHeight: 26, color: TOK.text, padding: 14 },
  highlight: {
    backgroundColor: TOK.primaryDim, color: TOK.primary,
    paddingHorizontal: 4, borderRadius: 4, fontWeight: '600',
  },
  grumpyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: TOK.surface,
    borderWidth: 1, borderColor: TOK.borderSoft, borderRadius: 10,
  },
  grumpyRowActive: { backgroundColor: TOK.primaryDim, borderColor: TOK.primary },
  grumpyText: { fontSize: 13, fontWeight: '600', color: TOK.text },
  grumpyTextActive: { color: TOK.primary },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, padding: 14,
    backgroundColor: TOK.surface, borderRadius: 10,
    borderWidth: 1, borderColor: TOK.borderSoft,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: TOK.danger,
  },
  statusHint: { fontSize: 13, color: TOK.textMuted, flex: 1 },
  footer: { padding: 18, paddingBottom: 36 },
  recordingDisclosure: {
    fontSize: 10, color: TOK.textDim, textAlign: 'center',
    marginTop: 10, lineHeight: 14,
  },
});
