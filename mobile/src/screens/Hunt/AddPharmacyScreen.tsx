import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { nearbyPharmacies, addPharmacyFromPlace, NearbyCandidate } from '../../api/pharmacies';
import { HuntStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HuntStackParamList, 'AddPharmacy'>;

export function AddPharmacyScreen() {
  const navigation = useNavigation<Nav>();
  const [candidates, setCandidates] = useState<NearbyCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null); // place_id being added
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNearby();
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nearby Pharmacies</Text>
        <TouchableOpacity onPress={loadNearby} disabled={loading}>
          <Text style={[styles.refresh, loading && styles.refreshDim]}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14,
    borderBottomWidth: 0.5, borderBottomColor: TOK.borderSoft,
  },
  cancel: { fontSize: 15, color: TOK.textMuted },
  title: { fontSize: 16, fontWeight: '600', color: TOK.text },
  refresh: { fontSize: 22, color: TOK.primary, paddingHorizontal: 4 },
  refreshDim: { opacity: 0.4 },
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
