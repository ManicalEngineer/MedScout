import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { TOK } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { api } from '../../api/client';

interface MapReport {
  id: number;
  pharmacy_name: string;
  pharmacy_address?: string;
  latitude?: number;
  longitude?: number;
  zip_code?: string;
  medication_name: string;
  strength: string;
  status: string;
  source: string;
  reported_at: string;
  trust_level: string;
}

interface HeatmapEntry {
  zip_code: string;
  total_reports: number;
  in_stock_count: number;
  fill_rate: number;
}

const FILTER_SOURCES = [
  { id: 'my_logs', label: 'My Logs' },
  { id: 'comm', label: 'Community' },
  { id: 'off', label: 'Official' },
];

export function MapScreen() {
  const [reports, setReports] = useState<MapReport[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [heatmapLocked, setHeatmapLocked] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showG2G, setShowG2G] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ my_logs: false, comm: true, off: false });
  const [selectedReport, setSelectedReport] = useState<MapReport | null>(null);

  useEffect(() => {
    loadReports();
  }, [activeFilters]);

  const loadReports = async () => {
    try {
      const source = activeFilters.my_logs ? 'my_logs'
        : activeFilters.comm && activeFilters.off ? undefined
        : activeFilters.comm ? 'community'
        : activeFilters.off ? 'fda'
        : undefined;
      const q = source ? `?source=${source}` : '';
      const data = await api.get<MapReport[]>(`/availability/map${q}`);
      setReports(data);
    } catch { /* silent */ }
  };

  const loadHeatmap = async () => {
    try {
      const data = await api.get<HeatmapEntry[]>('/availability/heatmap');
      setHeatmap(data);
      setHeatmapLocked(false);
      setShowHeatmap(true);
    } catch (e: any) {
      if (e?.status === 403) {
        setShowG2G(true);
      }
    }
  };

  const handleHeatmapPress = () => {
    if (heatmapLocked) {
      setShowG2G(true);
    } else {
      setShowHeatmap(s => !s);
    }
  };

  const trustColor = (level: string) => {
    if (level === 'fresh') return TOK.success;
    if (level === 'aging') return '#eab308';
    return TOK.textMuted;
  };

  const statusColor = (s: string) =>
    s === 'in_stock' ? TOK.success : s === 'out_of_stock' ? TOK.danger : TOK.primary;

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.sub}>Community reports · last 48h</Text>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTER_SOURCES.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterBtn, activeFilters[f.id as keyof typeof activeFilters] && styles.filterBtnActive]}
              onPress={() => setActiveFilters(s => ({ ...s, [f.id]: !s[f.id as keyof typeof activeFilters] }))}
            >
              <Text style={[styles.filterText, activeFilters[f.id as keyof typeof activeFilters] && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Map placeholder */}
      <View style={styles.mapArea}>
        <View style={styles.mapGrid} />
        <Text style={styles.mapPlaceholder}>
          📍 Map view requires device location{'\n'}
          <Text style={styles.mapSub}>Report list shown below</Text>
        </Text>

        {/* Heatmap toggle */}
        <TouchableOpacity style={[styles.heatmapBtn, !heatmapLocked && showHeatmap && styles.heatmapBtnActive]} onPress={handleHeatmapPress}>
          <Text style={styles.heatmapBtnText}>{heatmapLocked ? '🔒' : '✦'} Heatmap</Text>
        </TouchableOpacity>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { label: 'fresh', color: TOK.success },
            { label: '2-24h', color: '#eab308' },
            { label: 'old', color: TOK.textMuted },
            { label: 'out', color: TOK.danger },
          ].map(l => (
            <Text key={l.label} style={[styles.legendItem, { color: l.color }]}>● {l.label}</Text>
          ))}
        </View>

        {/* Give-to-get overlay */}
        {showG2G && (
          <View style={styles.g2gOverlay}>
            <Card accent style={{ ...styles.g2gCard, borderColor: TOK.vault }}>
              <Text style={styles.g2gLabel}>🔒 COMMUNITY HEATMAP</Text>
              <Text style={styles.g2gTitle}>Give to get</Text>
              <Text style={styles.g2gBody}>
                Log a verified call from your hunt this week to unlock the community heatmap for 30 days.
              </Text>
              <View style={styles.g2gActions}>
                <TouchableOpacity onPress={() => setShowG2G(false)} style={styles.g2gBtn}>
                  <Text style={styles.g2gBtnText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.g2gBtn, styles.g2gBtnPrimary]}
                  onPress={() => { setShowG2G(false); Alert.alert('Log a call from Hunt first!'); }}
                >
                  <Text style={[styles.g2gBtnText, { color: TOK.bg }]}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}
      </View>

      {/* Heatmap ZIP data */}
      {showHeatmap && heatmap.length > 0 && (
        <ScrollView style={styles.heatList} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.sectionLabel}>FILL RATES BY ZIP</Text>
          {heatmap.slice(0, 10).map(entry => (
            <View key={entry.zip_code} style={styles.zipRow}>
              <Text style={styles.zipCode}>{entry.zip_code}</Text>
              <View style={styles.zipBar}>
                <View style={[styles.zipFill, { width: `${entry.fill_rate * 100}%` as any, backgroundColor: entry.fill_rate > 0.5 ? TOK.success : entry.fill_rate > 0.2 ? TOK.primary : TOK.danger }]} />
              </View>
              <Text style={styles.zipPct}>{Math.round(entry.fill_rate * 100)}%</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Report list */}
      {!showHeatmap && (
        <ScrollView style={styles.reportList} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.sectionLabel}>RECENT REPORTS · {reports.length}</Text>
          {reports.length === 0 && (
            <Text style={styles.emptyText}>No reports in this area yet.</Text>
          )}
          {reports.slice(0, 20).map(r => (
            <TouchableOpacity key={r.id} onPress={() => setSelectedReport(r === selectedReport ? null : r)}>
              <Card style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportName}>{r.pharmacy_name}</Text>
                  <Badge kind={r.trust_level === 'fresh' ? 'success' : r.trust_level === 'aging' ? 'primary' : 'muted'}>
                    {formatTime(r.reported_at)}
                  </Badge>
                </View>
                <Text style={styles.reportAddr}>{r.pharmacy_address ?? r.zip_code ?? ''}</Text>
                <View style={styles.reportFooter}>
                  <View style={[styles.reportDot, { backgroundColor: statusColor(r.status) }]} />
                  <Text style={[styles.reportStatus, { color: statusColor(r.status) }]}>
                    {r.status.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.reportMed}>{r.medication_name} · {r.strength}</Text>
                </View>
                {selectedReport?.id === r.id && (
                  <Text style={styles.reportSrc}>Source: {r.source}</Text>
                )}
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 30, fontWeight: '700', color: TOK.text, letterSpacing: -0.6, marginBottom: 2 },
  sub: { fontSize: 12, color: TOK.textMuted, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 7,
    borderWidth: 1, borderColor: TOK.border, borderRadius: 8,
    alignItems: 'center',
  },
  filterBtnActive: { borderColor: TOK.primary, backgroundColor: TOK.primaryDim },
  filterText: { fontSize: 12, fontWeight: '600', color: TOK.textMuted },
  filterTextActive: { color: TOK.primary },
  mapArea: {
    height: 200, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#0a0e14', borderWidth: 1, borderColor: TOK.border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  mapGrid: { position: 'absolute', inset: 0 },
  mapPlaceholder: { fontSize: 14, color: TOK.textMuted, textAlign: 'center', lineHeight: 22 },
  mapSub: { fontSize: 12, color: TOK.textDim },
  heatmapBtn: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: TOK.surface, borderWidth: 1, borderColor: TOK.vault,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  heatmapBtnActive: { backgroundColor: TOK.vaultDim },
  heatmapBtnText: { fontSize: 12, fontWeight: '600', color: TOK.vault },
  legend: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: 'rgba(22,27,34,0.9)', borderRadius: 8, padding: 6,
  },
  legendItem: { fontSize: 10, fontWeight: '500' },
  g2gOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(13,17,23,0.85)',
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  g2gCard: { width: '100%', borderColor: TOK.vault },
  g2gLabel: { fontSize: 11, color: TOK.vault, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  g2gTitle: { fontSize: 16, fontWeight: '700', color: TOK.text, marginBottom: 6 },
  g2gBody: { fontSize: 13, color: TOK.textMuted, lineHeight: 18, marginBottom: 12 },
  g2gActions: { flexDirection: 'row', gap: 8 },
  g2gBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: TOK.border,
  },
  g2gBtnPrimary: { backgroundColor: TOK.vault, borderColor: TOK.vault },
  g2gBtnText: { fontSize: 13, fontWeight: '600', color: TOK.textMuted },
  heatList: { flex: 1 },
  reportList: { flex: 1 },
  sectionLabel: { fontSize: 11, color: TOK.textDim, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  emptyText: { fontSize: 13, color: TOK.textMuted, textAlign: 'center', padding: 20 },
  reportCard: { marginBottom: 8 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  reportName: { fontSize: 14, fontWeight: '600', color: TOK.text, flex: 1, marginRight: 8 },
  reportAddr: { fontSize: 11, color: TOK.textDim, marginBottom: 6 },
  reportFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportDot: { width: 6, height: 6, borderRadius: 3 },
  reportStatus: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  reportMed: { fontSize: 11, color: TOK.textMuted, marginLeft: 4 },
  reportSrc: { fontSize: 11, color: TOK.textDim, marginTop: 6, fontStyle: 'italic' },
  zipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  zipCode: { fontSize: 13, fontWeight: '600', color: TOK.text, width: 54 },
  zipBar: { flex: 1, height: 6, backgroundColor: TOK.surface2, borderRadius: 3, overflow: 'hidden' },
  zipFill: { height: '100%', borderRadius: 3 },
  zipPct: { fontSize: 12, fontWeight: '600', color: TOK.textMuted, width: 36, textAlign: 'right' },
});
