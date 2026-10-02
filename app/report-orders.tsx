import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { storeOrderReport } from '@/src/api/api';

const PRIMARY = COLORS.primary;

type OrderResult = {
  active: number; paused: number; completed: number; cancelled: number; total: number;
};

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const rev = [...values].reverse();
  const max = Math.max(...rev, 1);
  return (
    <View style={bc.wrap}>
      <View style={bc.chart}>
        {rev.map((v, i) => (
          <View key={i} style={bc.col}>
            <Text style={bc.val}>{v > 0 ? v : ''}</Text>
            <View style={bc.track}>
              <View style={[bc.bar, { height: Math.max((v / max) * 90, v > 0 ? 4 : 0) }]} />
            </View>
            <Text style={bc.lbl}>{labels[labels.length - 1 - i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  wrap:  { backgroundColor: '#fafafa', borderRadius: 14, padding: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 130 },
  col:   { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  track: { width: '70%', height: 90, justifyContent: 'flex-end' },
  bar:   { width: '100%', backgroundColor: '#6366f1', borderRadius: 4 },
  val:   { fontSize: 8, color: '#aaa', marginBottom: 2, fontWeight: '600' },
  lbl:   { fontSize: 9, color: '#bbb', marginTop: 4, fontWeight: '600' },
});

const STATUSES = [
  { key: 'active',    label: 'Active',    color: '#16a34a', bg: '#dcfce7' },
  { key: 'paused',    label: 'Paused',    color: '#f59e0b', bg: '#fef9c3' },
  { key: 'completed', label: 'Completed', color: '#6b7280', bg: '#f3f4f6' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444', bg: '#fee2e2' },
] as const;

export default function ReportOrdersScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result,     setResult]     = useState<OrderResult | null>(null);
  const [chart,      setChart]      = useState<number[]>([]);
  const [months,     setMonths]     = useState<string[]>([]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await storeOrderReport();
      const d   = res.data;
      setResult(d.data);
      setChart(d.chart   || []);
      setMonths(d.months || []);
    } catch {
      Alert.alert('Error', 'Failed to load orders report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Orders Report</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY} />}
      >
        {result && (
          <>
            {/* ── Total ── */}
            <View style={s.totalCard}>
              <Text style={s.totalLabel}>Total Orders</Text>
              <Text style={s.totalValue}>{result.total}</Text>
              <Text style={s.totalSub}>All subscriptions ever created</Text>
            </View>

            {/* ── Status grid ── */}
            <Text style={s.sectionTitle}>By Status</Text>
            <View style={s.grid}>
              {STATUSES.map(st => (
                <View key={st.key} style={[s.gridCard, { borderTopColor: st.color, borderTopWidth: 4 }]}>
                  <Text style={[s.gridVal, { color: st.color }]}>{result[st.key]}</Text>
                  <Text style={s.gridLabel}>{st.label}</Text>
                </View>
              ))}
            </View>

            {/* ── Progress bars ── */}
            <Text style={s.sectionTitle}>Distribution</Text>
            <View style={s.progressBox}>
              {STATUSES.map(st => {
                const pct = result.total > 0 ? (result[st.key] / result.total) * 100 : 0;
                return (
                  <View key={st.key} style={s.progressRow}>
                    <View style={[s.progressDot, { backgroundColor: st.color }]} />
                    <Text style={s.progressLabel}>{st.label}</Text>
                    <View style={s.progressTrack}>
                      <View style={[s.progressBar, { width: `${pct}%`, backgroundColor: st.color }]} />
                    </View>
                    <Text style={[s.progressPct, { color: st.color }]}>{Math.round(pct)}%</Text>
                  </View>
                );
              })}
            </View>

            {/* ── Chart ── */}
            <Text style={s.sectionTitle}>Monthly Orders (Last 12 Months)</Text>
            {chart.length > 0 && <BarChart values={chart} labels={months} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f7' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  scroll:      { padding: 16, paddingBottom: 48 },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },

  totalCard:  { backgroundColor: PRIMARY, borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  totalValue: { color: '#fff', fontSize: 52, fontWeight: '900', lineHeight: 58 },
  totalSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 },

  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  gridCard:   { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  gridVal:    { fontSize: 32, fontWeight: '900', marginBottom: 4 },
  gridLabel:  { fontSize: 12, color: '#9ca3af', fontWeight: '600' },

  progressBox:    { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  progressRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  progressDot:    { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  progressLabel:  { width: 74, fontSize: 12, color: '#6b7280', fontWeight: '600' },
  progressTrack:  { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  progressBar:    { height: '100%', borderRadius: 4, minWidth: 4 },
  progressPct:    { width: 36, fontSize: 12, fontWeight: '800', textAlign: 'right' },
});
