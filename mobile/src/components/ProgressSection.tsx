import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { TOK } from '../theme/tokens';
import { Card } from './Card';
import { Toggle } from './Toggle';
import { BadgeIcon } from './BadgeIcon';
import { NicknamePicker } from './NicknamePicker';
import { updateMe } from '../api/auth';
import type { Progress, ProgressBadge } from '../api/gamification';

interface Props {
  progress: Progress;
  onChanged: () => void;
}

function streakLine(p: Progress): string {
  const { current_months: cur, reported_this_month: thisMonth } = p.streak;
  if (cur === 0) return 'Share one call this month to start a streak';
  const months = `${cur}-month streak`;
  return thisMonth ? `🔥 ${months}` : `🔥 ${months} · share a call this month to keep it`;
}

/** Profile: nickname, monthly streak, badge shelf (locked ones greyed out) and
 *  the switch to hide all of it. */
export function ProgressSection({ progress, onChanged }: Props) {
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<ProgressBadge | null>(null);
  const [enabled, setEnabled] = useState(progress.gamification_enabled);
  useEffect(() => setEnabled(progress.gamification_enabled), [progress.gamification_enabled]);

  const toggle = async (value: boolean) => {
    setEnabled(value);
    try {
      await updateMe({ gamification_enabled: value });
      onChanged();
    } catch (e: any) {
      setEnabled(!value);
      Alert.alert('Error', e.message || 'Could not update setting');
    }
  };

  const earnedCount = progress.badges.filter(b => b.earned).length;

  return (
    <>
      <Text style={styles.sectionLabel}>BADGES</Text>
      <Card style={styles.card}>
        {enabled && (
          <>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel={progress.nickname ? `Nickname ${progress.nickname}, change` : 'Pick a nickname'}
            >
              <View style={styles.flex}>
                <Text style={styles.rowKey}>Nickname</Text>
                <Text style={styles.rowSub}>Optional. Only you see it.</Text>
              </View>
              <Text style={progress.nickname ? styles.nickname : styles.pick}>
                {progress.nickname ?? 'Pick one'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={[styles.row, styles.divider]}>
              <Text style={styles.streak}>{streakLine(progress)}</Text>
            </View>
            {progress.streak.longest_months > progress.streak.current_months && (
              <Text style={styles.best}>Best: {progress.streak.longest_months} months</Text>
            )}

            <View style={styles.divider}>
              <Text style={styles.count}>
                {earnedCount} of {progress.badges.length} earned
                {progress.next_badge
                  ? ` · ${progress.next_badge.remaining} more ${progress.next_badge.remaining === 1 ? 'report' : 'reports'} to ${progress.next_badge.name}`
                  : ''}
              </Text>
              <View style={styles.shelf}>
                {progress.badges.map(b => (
                  <TouchableOpacity
                    key={b.key}
                    style={styles.shelfItem}
                    onPress={() => setSelected(selected?.key === b.key ? null : b)}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.name}, ${b.earned ? 'earned' : 'not earned yet'}. ${b.description}`}
                  >
                    <BadgeIcon badgeKey={b.key} size={46} locked={!b.earned} />
                    <Text style={[styles.shelfName, !b.earned && styles.shelfNameLocked]} numberOfLines={2}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {selected && (
                <View style={styles.detail}>
                  <Text style={styles.detailName}>{selected.name}</Text>
                  <Text style={styles.detailDesc}>{selected.description}</Text>
                  {selected.earned && selected.awarded_on && (
                    <Text style={styles.detailDate}>Earned {new Date(selected.awarded_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        <View style={[styles.row, enabled && styles.divider]}>
          <View style={styles.flex}>
            <Text style={styles.rowKey}>Show badges & streaks</Text>
            {!enabled && <Text style={styles.rowSub}>Hidden. You keep earning them in the background.</Text>}
          </View>
          <Toggle value={enabled} onValueChange={toggle} accessibilityLabel="Show badges and streaks" />
        </View>
      </Card>

      <NicknamePicker
        visible={picking}
        current={progress.nickname}
        onClose={() => setPicking(false)}
        onSaved={() => { setPicking(false); onChanged(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  card: { marginBottom: 20 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  divider: { borderTopWidth: 0.5, borderTopColor: TOK.borderSoft, marginTop: 8, paddingTop: 10 },
  rowKey: { fontSize: 13, fontWeight: '500', color: TOK.text },
  rowSub: { fontSize: 11, color: TOK.textMuted, marginTop: 2 },
  nickname: { fontSize: 14, fontWeight: '700', color: TOK.text },
  pick: { fontSize: 13, fontWeight: '600', color: TOK.primary },
  chevron: { fontSize: 18, color: TOK.textDim },
  streak: { fontSize: 14, fontWeight: '600', color: TOK.text, flex: 1 },
  best: { fontSize: 11, color: TOK.textMuted, marginTop: 2 },
  count: { fontSize: 12, color: TOK.textMuted, marginBottom: 12 },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  shelfItem: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  shelfName: { fontSize: 10, color: TOK.text, textAlign: 'center', fontWeight: '600' },
  shelfNameLocked: { color: TOK.textDim },
  detail: {
    marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: TOK.surface2,
    borderWidth: 1, borderColor: TOK.border,
  },
  detailName: { fontSize: 14, fontWeight: '700', color: TOK.text },
  detailDesc: { fontSize: 12, color: TOK.textMuted, marginTop: 4 },
  detailDate: { fontSize: 11, color: TOK.primary, marginTop: 6, fontWeight: '600' },
});
