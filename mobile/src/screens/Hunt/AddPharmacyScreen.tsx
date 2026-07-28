import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { nearbyPharmacies, addPharmacyFromPlace, createPharmacy, NearbyCandidate } from '../../api/pharmacies';
import { HuntStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'AddPharmacy'>;

export function AddPharmacyScreen() {
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<'nearby' | 'manual'>('nearby');
  const [candidates, setCandidates] = useState<NearbyCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null); // place_id being added
  const [error, setError] = useState<string | null>(null);

  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const manualScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadNearby();
  }, []);

  // The "Add pharmacy" button sits below the form fields — without this, the
  // keyboard can cover it entirely with no way to scroll it into view.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // See LoginScreen.tsx — KeyboardAvoidingView's animation needs a moment
      // to finish resizing the scroll area before this scroll will land right.
      setTimeout(() => manualScrollRef.current?.scrollToEnd({ animated: true }), 250);
    });
    return () => sub.remove();
  }, []);

  const loadNearby = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to find nearby pharmacies.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const results = await nearbyPharmacies(loc.coords.latitude, loc.coords.longitude);
      setCandidates(results);
    } catch (e: any) {
      setError(e?.message || 'Could not load nearby pharmacies.');
    } finally {
      setLoading(false);
    }
  };

  const addPharmacy = async (candidate: NearbyCandidate) => {
    if (candidate.already_saved) return;
    setAdding(candidate.place_id);
    try {
      await addPharmacyFromPlace(candidate.place_id);
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.message || 'Could not add pharmacy.';
      Alert.alert('Could not add', msg);
    } finally {
      setAdding(null);
    }
  };

  const addManualPharmacy = async () => {
    if (!manualName.trim() || !manualPhone.trim()) {
      Alert.alert('Missing info', 'Name and phone are required.');
      return;
    }
    setSavingManual(true);
    try {
      await createPharmacy({
        name: manualName.trim(),
        phone: manualPhone.trim(),
        address: manualAddress.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not add', e?.message || 'Could not add pharmacy.');
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'nearby' ? 'Nearby Pharmacies' : 'Add Manually'}</Text>
        {mode === 'nearby' ? (
          <TouchableOpacity onPress={loadNearby} disabled={loading}>
            <Text style={[styles.refresh, loading && styles.refreshDim]}>↻</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'nearby' && styles.modeBtnActive]}
          onPress={() => setMode('nearby')}
        >
          <Text style={[styles.modeBtnText, mode === 'nearby' && styles.modeBtnTextActive]}>Nearby search</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
          onPress={() => setMode('manual')}
        >
          <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>Add manually</Text>
        </TouchableOpacity>
      </View>

      {mode === 'manual' ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={manualScrollRef} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>PHARMACY NAME</Text>
            <TextInput
              testID="manual-pharmacy-name-input"
              style={styles.input}
              value={manualName}
              onChangeText={setManualName}
              placeholder="e.g. Corner Drug Pharmacy"
              placeholderTextColor={TOK.textDim}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>PHONE</Text>
            <TextInput
              testID="manual-pharmacy-phone-input"
              style={styles.input}
              value={manualPhone}
              onChangeText={setManualPhone}
              placeholder="(555) 555-5555"
              placeholderTextColor={TOK.textDim}
              keyboardType="phone-pad"
            />
            <Text style={[styles.label, { marginTop: 12 }]}>ADDRESS (OPTIONAL)</Text>
            <TextInput
              testID="manual-pharmacy-address-input"
              style={styles.input}
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="123 Main St"
              placeholderTextColor={TOK.textDim}
            />
            <Button
              testID="manual-pharmacy-submit-button"
              variant="primary" size="lg" onPress={addManualPharmacy}
              loading={savingManual} style={styles.saveBtn}
            >
              Add pharmacy
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TOK.primary} size="large" />
          <Text style={styles.centerText}>Finding nearby pharmacies…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadNearby} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : candidates.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>No pharmacies found nearby.</Text>
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(c) => c.place_id}
          contentContainerStyle={styles.list}
          renderItem={({ item: c }) => {
            const isAdding = adding === c.place_id;
            return (
              <Card style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.name, c.already_saved && styles.nameDim]}>{c.name}</Text>
                  <Text style={styles.address}>{c.address}</Text>
                  {c.distance_miles != null && (
                    <Text style={styles.distance}>{c.distance_miles} mi away</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    c.already_saved && styles.addBtnSaved,
                  ]}
                  onPress={() => addPharmacy(c)}
                  disabled={c.already_saved || !!adding}
                >
                  {isAdding ? (
                    <ActivityIndicator color={TOK.bg} size="small" />
                  ) : (
                    <Text style={[styles.addBtnText, c.already_saved && styles.addBtnTextSaved]}>
                      {c.already_saved ? '✓' : '+'}
                    </Text>
                  )}
                </TouchableOpacity>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft,
  },
  cancel: { fontSize: 15, color: TOK.textMuted },
  title: { fontSize: 16, fontWeight: '600', color: TOK.text },
  refresh: { fontSize: 22, color: TOK.primary, paddingHorizontal: 4 },
  refreshDim: { opacity: 0.4 },
  flex: { flex: 1 },
  modeToggle: {
    flexDirection: 'row', backgroundColor: TOK.surface, borderRadius: 10,
    padding: 3, borderWidth: 1, borderColor: TOK.borderSoft, margin: 16, marginBottom: 0,
  },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: TOK.primary },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: TOK.textMuted },
  modeBtnTextActive: { color: TOK.bg },
  form: { padding: 16 },
  label: { fontSize: 11, fontWeight: '600', color: TOK.textDim, letterSpacing: 0.6, marginBottom: 6 },
  input: {
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 10, padding: 14, fontSize: 15, color: TOK.text,
  },
  saveBtn: { marginTop: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centerText: { fontSize: 14, color: TOK.textMuted, textAlign: 'center' },
  errorText: { fontSize: 14, color: TOK.danger, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: TOK.primary, borderRadius: 10,
  },
  retryText: { fontSize: 14, color: TOK.primary, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: TOK.text, marginBottom: 2 },
  nameDim: { color: TOK.textMuted },
  address: { fontSize: 12, color: TOK.textMuted, marginBottom: 2 },
  distance: { fontSize: 11, color: TOK.textDim },
  addBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: TOK.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnSaved: { backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.borderSoft },
  addBtnText: { fontSize: 20, color: TOK.bg, fontWeight: '700', lineHeight: 24 },
  addBtnTextSaved: { fontSize: 16, color: TOK.success },
});
