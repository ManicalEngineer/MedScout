// Shared medication/dose/supply picker — used by OnboardingScreen (first
// medication, embedded in the step wizard) and ProfileScreen ("add another
// medication", in its own modal). A controlled component: the caller owns
// selectedMed/dose/supply state and renders its own action buttons, so each
// screen can wrap it in whatever chrome (wizard footer vs. modal Save/Cancel)
// fits its flow.
import React, { useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet,
} from 'react-native';
import { TOK } from '../theme/tokens';

export interface MedicationOption {
  brand: string;
  form: string;
  doses: string[];
}

export const ADHD_MEDS: MedicationOption[] = [
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

interface Props {
  selectedMed: MedicationOption;
  dose: string;
  supply: number;
  query: string;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelectMed: (m: MedicationOption) => void;
  onSelectDose: (d: string) => void;
  onSupplyChange: (n: number) => void;
  onQueryChange: (q: string) => void;
}

export function MedicationPickerFields({
  selectedMed, dose, supply, query, pickerOpen,
  onOpenPicker, onClosePicker, onSelectMed, onSelectDose, onSupplyChange, onQueryChange,
}: Props) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return ADHD_MEDS;
    return ADHD_MEDS.filter(m => m.brand.toLowerCase().includes(q) || m.form.toLowerCase().includes(q));
  }, [query]);

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
        {selectedMed.doses.map(d => (
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  medSelector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 10, padding: 14, gap: 8,
  },
  medSelectorBrand: { fontSize: 15, fontWeight: '600', color: TOK.text },
  medForm: { fontSize: 12, color: TOK.textMuted, fontWeight: '400' },
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
  medDoses: { fontSize: 11, color: TOK.textDim },
});
