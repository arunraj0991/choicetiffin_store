import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { storeSaleReport } from '@/src/api/api';

const PRIMARY = COLORS.primary;

type SaleResult = {
  total:      { commission: number; net_earning: number };
  this_month: { commission: number; net_earning: number };
  this_week:  { commission: number; net_earning: number };
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
  bar:   { width: '100%', backgroundColor: PRIMARY, borderRadius: 4 },
  val:   { fontSize: 8, color: '#aaa', marginBottom: 2, fontWeight: '600' },
  lbl:   { fontSize: 9, color: '#bbb', marginTop: 4, fontWeight: '600' },
});

export default function ReportSalesScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result,     setResult]     = useState<SaleResult | null>(null);
  const [chart,      setChart]      = useState<number[]>([]);
  const [months,     setMonths]     = useState<string[]>([]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await storeSaleReport();
      const d   = res.data;
      setResult(d.data);
      setChart(d.chart  || []);
      setMonths(d.months || []);
    } catch {
      Alert.alert('Error', 'Failed to load sales report.');
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
        <Text style={s.headerTitle}>Sales & Revenue</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY} />}
      >
        {result && (
          <>
            {/* ── This Week ── */}
            <Text style={s.sectionTitle}>This Week</Text>
            <View style={s.row}>
              <StatCard label="Net Earning"  value={result.this_week.net_earning}  color={PRIMARY}    icon="trending-up" />
              <StatCard label="Commission"   value={result.this_week.commission}   color="#ef4444"    icon="remove-circle-outline" />
            </View>

            {/* ── This Month ── */}
            <Text style={s.sectionTitle}>This Month</Text>
            <View style={s.row}>
              <StatCard label="Net Earning"  value={result.this_month.net_earning} color={PRIMARY}    icon="trending-up" />
              <StatCard label="Commission"   value={result.this_month.commission}  color="#ef4444"    icon="remove-circle-outline" />
            </View>

            {/* ── All Time ── */}
            <Text style={s.sectionTitle}>All Time</Text>
            <View style={s.row}>
              <StatCard label="Net Earning"  value={result.total.net_earning}      color={PRIMARY}    icon="trending-up" />
              <StatCard label="Commission"   value={result.total.commission}       color="#ef4444"    icon="remove-circle-outline" />
            </View>

            {/* ── Summary row ── */}
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Gross Revenue</Text>
                <Text style={s.summaryVal}>{result.total.net_earning + result.total.commission}</Text>
              </View>
              <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={s.summaryLabel}>Your Share (after commission)</Text>
                <Text style={[s.summaryVal, { color: PRIMARY }]}>{result.total.net_earning}</Text>
              </View>
            </View>

            {/* ── Chart ── */}
            <Text style={s.sectionTitle}>Monthly Net Earning (Last 12 Months)</Text>
            {chart.length > 0 && <BarChart values={chart} labels={months} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const StatCard = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) => (
  <View style={s.statCard}>
    <View style={[s.statIconWrap, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f5f5f7' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:     { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle:{ color: '#fff', fontSize: 20, fontWeight: '800' },
  scroll:     { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
  row:        { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard:   { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIconWrap:{ width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue:  { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  statLabel:  { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  summaryCard:{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  summaryLabel:{ fontSize: 13, color: '#6b7280', fontWeight: '500' },
  summaryVal: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
});
