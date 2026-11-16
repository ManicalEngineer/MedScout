import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOK } from '../theme/tokens';
import { Button } from './Button';
import { getNicknameSuggestions, setNickname } from '../api/gamification';

interface Props {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onSaved: (nickname: string | null) => void;
}

/** Tap-to-pick first; typing a custom name is the fallback. */
export function NicknamePicker({ visible, current, onClose, onSaved }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typing, setTyping] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSuggestions((await getNicknameSuggestions()).suggestions);
    } catch (e: any) {
      setError(e.message || 'Could not load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setTyping(false);
      setCustom('');
      refresh();
    }
  }, [visible, refresh]);

  const save = async (name: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await setNickname(name);
      onSaved(res.nickname);
    } catch (e: any) {
      setError(e.message || 'Could not save nickname');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NICKNAME</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.body}>
          <Text style={styles.lead}>Pick one. Only you see it, on your profile and badges.</Text>

          {loading ? (
            <ActivityIndicator color={TOK.primary} style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.chips}>
              {suggestions.map(name => (
                <TouchableOpacity
                  key={name}
                  style={styles.chip}
                  onPress={() => save(name)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${name}`}
                >
                  <Text style={styles.chipText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={refresh} disabled={loading || saving} accessibilityRole="button">
            <Text style={styles.link}>↻ Show me others</Text>
          </TouchableOpacity>

          {typing ? (
            <View style={styles.customRow}>
              <TextInput
                style={styles.input}
                value={custom}
                onChangeText={setCustom}
                placeholder="3–20 letters or numbers"
                placeholderTextColor={TOK.textDim}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={20}
                autoFocus
              />
              <Button variant="primary" size="sm" full={false} onPress={() => save(custom)} loading={saving}>
                Save
              </Button>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setTyping(true)} accessibilityRole="button">
              <Text style={[styles.link, styles.linkMuted]}>Type my own instead</Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

          {current && (
            <TouchableOpacity onPress={() => save(null)} disabled={saving} style={styles.removeRow} accessibilityRole="button">
              <Text style={styles.remove}>Remove nickname ({current})</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  cancel: { fontSize: 15, color: TOK.textMuted, width: 50 },
  headerTitle: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6 },
  body: { padding: 20, gap: 14 },
  lead: { fontSize: 14, color: TOK.textMuted, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center',
    borderRadius: 999, borderWidth: 1, borderColor: TOK.primary, backgroundColor: TOK.primaryDim,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: TOK.text },
  link: { fontSize: 13, color: TOK.primary, fontWeight: '600', paddingVertical: 6 },
  linkMuted: { color: TOK.textMuted },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, backgroundColor: TOK.surface2, borderWidth: 1, borderColor: TOK.border,
    borderRadius: 8, padding: 10, fontSize: 14, color: TOK.text,
  },
  error: { fontSize: 13, color: TOK.danger },
  removeRow: { marginTop: 12, paddingVertical: 8 },
  remove: { fontSize: 13, color: TOK.textMuted },
});
