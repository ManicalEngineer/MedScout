import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, FlatList, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOK } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Toggle } from '../../components/Toggle';
import { createProfile } from '../../storage/medicationProfiles';
import { createPharmacy } from '../../api/pharmacies';
import { useAuth } from '../../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

const ADHD_MEDS = [
  { brand: 'Adderall', form: 'IR', doses: ['5mg','7.5mg','10mg','12.5mg','15mg','20mg','30mg'] },
  { brand: 'Adderall XR', form: 'ER cap', doses: ['5mg','10mg','15mg','20mg','25mg','30mg'] },
  { brand: 'Vyvanse', form: 'cap', doses: ['10mg','20mg','30mg','40mg','50mg','60mg','70mg'] },
  { brand: 'Concerta', form: 'ER tab', doses: ['18mg','27mg','36mg','54mg'] },
  { brand: 'Ritalin', form: 'IR', doses: ['5mg','10mg','20mg'] },
  { brand: 'Ritalin LA', form: 'ER cap', doses: ['10mg','20mg','30mg','40mg','60mg'] },
  { brand: 'Focalin XR', form: 'ER cap', doses: ['5mg','10mg','15mg','20mg','25mg','30mg'] },
  { brand: 'Strattera', form: 'cap', doses: ['10mg','18mg','25mg','40mg','60mg','80mg','100mg'] },
  { brand: 'Amphetamine salts', form: 'IR', doses: ['5mg','7.5mg','10mg','12.5mg','15mg','20mg','30mg'] },
  { brand: 'Amphetamine salts', form: 'ER cap', doses: ['5mg','10mg','15mg','20mg','25mg','30mg'] },
  { brand: 'Methylphenidate', form: 'IR', doses: ['5mg','10mg','20mg'] },
  { brand: 'Methylphenidate', form: 'ER tab', doses: ['18mg','27mg','36mg','54mg'] },
  { brand: 'Lisdexamfetamine', form: 'cap', doses: ['10mg','20mg','30mg','40mg','50mg','60mg','70mg'] },
];

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return ADHD_MEDS;
    return ADHD_MEDS.filter((m: typeof ADHD_MEDS[0]) =>
      m.brand.toLowerCase().includes(q) || m.form.toLowerCase().includes(q)
    );
  }, [query]);

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
        <StepMedication
          selectedMed={selectedMed}
          dose={dose}
          supply={supply}
          query={query}
          pickerOpen={pickerOpen}
          filtered={filtered}
          onOpenPicker={() => setPickerOpen(true)}
          onClosePicker={() => setPickerOpen(false)}
          onSelectMed={(m: typeof ADHD_MEDS[0]) => { setSelectedMed(m); setDose(m.doses[Math.floor(m.doses.length / 2)]); setPickerOpen(false); setQuery(''); }}
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

function StepMedication({
  selectedMed, dose, supply, query, pickerOpen, filtered,
  onOpenPicker, onClosePicker, onSelectMed, onSelectDose, onSupplyChange, onQueryChange,
}: any) {
  if (pickerOpen) {
    return (
      <View style={styles.flex}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClosePicker}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>SELECT MEDICATION</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            autoFocus
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search brand or form…"
            placeholderTextColor={TOK.textDim}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(m, i) => `${m.brand}-${m.form}-${i}`}
          renderItem={({ item: m }) => (
            <TouchableOpacity
              style={[styles.medRow, selectedMed.brand === m.brand && selectedMed.form === m.form && styles.medRowSel]}
              onPress={() => onSelectMed(m)}
            >
              <View style={styles.flex}>
                <Text style={styles.medBrand}>{m.brand} <Text style={styles.medForm}>· {m.form}</Text></Text>
                <Text style={styles.medDoses}>{m.doses.length} doses</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
      <Text style={styles.subLabel}>MEDICATION</Text>
      <TouchableOpacity style={styles.medSelector} onPress={onOpenPicker}>
        <View style={styles.flex}>
          <Text style={styles.medSelectorBrand}>{selectedMed.brand} <Text style={styles.medForm}>· {selectedMed.form}</Text></Text>
        </View>
        <Text style={{ color: TOK.textMuted }}>▾</Text>
      </TouchableOpacity>

      <Text style={[styles.subLabel, { marginTop: 16 }]}>DOSE</Text>
      <View style={styles.doseGrid}>
        {selectedMed.doses.map((d: string) => (
          <TouchableOpacity
            key={d}
            style={[styles.doseBtn, dose === d && styles.doseBtnActive]}
            onPress={() => onSelectDose(d)}
          >
            <Text style={[styles.doseBtnText, dose === d && styles.doseBtnTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.subLabel, { marginTop: 16 }]}>SUPPLY</Text>
      <View style={styles.supplyRow}>
        <TouchableOpacity style={styles.supplyBtn} onPress={() => onSupplyChange(Math.max(1, supply - 1))}>
          <Text style={styles.supplyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.supplyValue}>{supply} <Text style={styles.supplyUnit}>days/refill</Text></Text>
        <TouchableOpacity style={styles.supplyBtn} onPress={() => onSupplyChange(supply + 1)}>
          <Text style={styles.supplyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  subLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  medSelector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 10, padding: 14, gap: 8,
  },
  medSelectorBrand: { fontSize: 15, fontWeight: '600', color: TOK.text },
  doseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  doseBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: TOK.border, borderRadius: 10,
  },
  doseBtnActive: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  doseBtnText: { fontSize: 13, fontWeight: '600', color: TOK.textMuted },
  doseBtnTextActive: { color: TOK.primary },
  supplyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border, borderRadius: 10, padding: 14,
  },
  supplyBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: TOK.surface2, borderWidth: 1, borderColor: TOK.border,
    alignItems: 'center', justifyContent: 'center',
  },
  supplyBtnText: { fontSize: 20, color: TOK.text, lineHeight: 24 },
  supplyValue: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: TOK.text },
  supplyUnit: { fontSize: 13, color: TOK.textMuted, fontWeight: '400' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backLink: { fontSize: 13, color: TOK.textMuted, padding: 4 },
  pickerTitle: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6 },
  searchRow: {
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 10, paddingHorizontal: 12, marginBottom: 10,
  },
  searchInput: { fontSize: 14, color: TOK.text, paddingVertical: 12 },
  medRow: {
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.borderSoft,
    borderRadius: 10, padding: 12, marginBottom: 5,
  },
  medRowSel: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  medBrand: { fontSize: 14, fontWeight: '600', color: TOK.text, marginBottom: 2 },
  medForm: { fontSize: 12, color: TOK.textMuted, fontWeight: '400' },
  medDoses: { fontSize: 11, color: TOK.textDim },
  vaultNote: { width: '100%', marginTop: 8 },
  vaultTitle: { fontSize: 11, color: TOK.vault, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  vaultBody: { fontSize: 12, color: TOK.text, lineHeight: 18 },
});
