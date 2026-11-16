import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { TOK } from '../theme/tokens';
import { Button } from './Button';
import { BadgeIcon } from './BadgeIcon';
import type { EarnedBadge } from '../api/gamification';

interface Props {
  badges: EarnedBadge[];
  onClose: () => void;
}

/** Shown right after a contribution earns one or more badges. One tap to
 *  dismiss; nothing to read or decide. */
export function BadgeCelebration({ badges, onClose }: Props) {
  const visible = badges.length > 0;
  const title = badges.length === 1 ? 'New badge!' : `${badges.length} new badges!`;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {badges.map(b => (
            <View key={b.key} style={styles.row}>
              <BadgeIcon badgeKey={b.key} size={52} />
              <View style={styles.flex}>
                <Text style={styles.name}>{b.name}</Text>
                <Text style={styles.desc}>{b.description}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.thanks}>Thanks for helping people near you find their medication.</Text>
          <Button variant="primary" size="lg" onPress={onClose} style={{ marginTop: 16 }}>
            Nice!
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: TOK.surface, borderRadius: 18, borderWidth: 1, borderColor: TOK.primary,
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: '700', color: TOK.text, textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: TOK.text },
  desc: { fontSize: 13, color: TOK.textMuted, marginTop: 2 },
  thanks: { fontSize: 12, color: TOK.textMuted, textAlign: 'center', marginTop: 4 },
});
