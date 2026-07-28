import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOK } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ADHD_MEDS, MedicationPickerFields } from '../../components/MedicationPicker';
import { createProfile } from '../../storage/medicationProfiles';
import { useAuth } from '../../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

export function OnboardingScreen({ navigation }: Props) {
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedMed, setSelectedMed] = useState(ADHD_MEDS[1]);
  const [dose, setDose] = useState('20mg');
  const [supply, setSupply] = useState(30);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const next = async () => {
    if (step < 2) { setStep(s => s + 1); return; }
    setSaving(true);
    try {
      await createProfile({
        medication_name: selectedMed.brand,
        strength: dose,
        formulation: selectedMed.form,
      });
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Progress dots */}
      <View style={styles.progress}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <Text style={styles.step}>STEP {step + 1} OF 3</Text>

      {step === 0 && <StepWelcome />}
      {step === 1 && (
        <MedicationPickerFields
          selectedMed={selectedMed}
          dose={dose}
          supply={supply}
          query={query}
          pickerOpen={pickerOpen}
          onOpenPicker={() => setPickerOpen(true)}
          onClosePicker={() => setPickerOpen(false)}
          onSelectMed={(m) => { setSelectedMed(m); setDose(m.doses[Math.floor(m.doses.length / 2)]); setPickerOpen(false); setQuery(''); }}
          onSelectDose={setDose}
          onSupplyChange={setSupply}
          onQueryChange={setQuery}
        />
      )}
      {step === 2 && (
        <StepDone
          med={`${selectedMed.brand} · ${selectedMed.form}`}
          dose={dose}
          supply={supply}
        />
      )}

      <View style={styles.footer}>
        <Button variant="primary" size="lg" onPress={next} loading={saving}>
          {step === 2 ? 'Open MedScout' : 'Continue'}
        </Button>
        {step > 0 && step < 2 && (
          <Button variant="ghost" size="md" onPress={() => setStep(s => s - 1)} style={{ marginTop: 8 }}>
            Back
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

function StepWelcome() {
  return (
    <View style={styles.stepCenter}>
      <View style={styles.iconCircle}>
        <Image source={require('../../../assets/dog-mark.png')} style={styles.logoMark} resizeMode="contain" />
      </View>
      <Text style={styles.stepTitle}>Welcome to MedScout</Text>
      <Text style={styles.stepBody}>Find your meds without the dread.</Text>
      <Text style={styles.stepBody2}>
        Call pharmacies efficiently, log results, and find stock from the community — without sharing more than you want to.
      </Text>
    </View>
  );
}

function StepDone({ med, dose, supply }: { med: string; dose: string; supply: number }) {
  return (
    <View style={styles.stepCenter}>
      <View style={[styles.iconCircle, { backgroundColor: TOK.successDim, borderColor: TOK.success }]}>
        <Text style={{ fontSize: 46 }}>✓</Text>
      </View>
      <Text style={styles.stepTitle}>{med} · {dose}</Text>
      <Text style={styles.stepBody}>{supply}-day supply tracked.</Text>
      <Card style={{ ...styles.vaultNote, backgroundColor: TOK.vaultDim, borderColor: 'rgba(139,92,246,0.4)' }}>
        <Text style={[styles.vaultTitle]}>🔒 VAULT IS PRIVATE</Text>
        <Text style={styles.vaultBody}>
          Your medication and call logs never leave your device unless you contribute to community.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg, padding: 20 },
  flex: { flex: 1 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: TOK.border },
  dotActive: { backgroundColor: TOK.primary },
  step: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  stepCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 8 },
  iconCircle: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: TOK.primaryDim, borderWidth: 2, borderColor: TOK.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoMark: { width: 56, height: 56 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: TOK.text, letterSpacing: -0.4, textAlign: 'center' },
  stepBody: { fontSize: 16, color: TOK.text, textAlign: 'center', lineHeight: 24 },
  stepBody2: { fontSize: 13, color: TOK.textMuted, textAlign: 'center', lineHeight: 20 },
  footer: { paddingTop: 16 },
  vaultNote: { width: '100%', marginTop: 8 },
  vaultTitle: { fontSize: 11, color: TOK.vault, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  vaultBody: { fontSize: 12, color: TOK.text, lineHeight: 18 },
});
