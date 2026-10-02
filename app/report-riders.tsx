import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { storeRiderReport } from '@/src/api/api';

const PRIMARY = COLORS.primary;

type RiderItem = {
  id: string; name: string; img: string | null; phone: string; status: number;
  today_delivery: number; total_delivery: number; earning: number; balance: number;
};
type Overview = { total: number; active: number; today: string[] };

export default function ReportRidersScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riders,     setRiders]     = useState<RiderItem[]>([]);
  const [overview,   setOverview]   = useState<Overview | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await storeRiderReport();
      const d   = res.data;
      setRiders(d.data     || []);
      setOverview(d.overview || null);
    } catch {
      Alert.alert('Error', 'Failed to load rider report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const initials = (name: string) =>
    name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const totalEarning  = riders.reduce((s, r) => s + r.earning, 0);
  const totalDelivery = riders.reduce((s, r) => s + r.total_delivery, 0);
  const todayTotal    = riders.reduce((s, r) => s + r.today_delivery, 0);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Delivery Staff Report</Text>
          {overview && <Text style={s.headerSub}>{overview.total} riders · {overview.active} active</Text>}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY} />}
      >
        {/* ── Overview stats ── */}
        {overview && (
          <>
            <Text style={s.sectionTitle}>Overview</Text>
            <View style={s.statsRow}>
              <StatCard label="Total Riders"  value={overview.total}            color={PRIMARY}    icon="people-outline" />
              <StatCard label="Active Riders" value={overview.active}           color="#16a34a"    icon="person-outline" />
              <StatCard label="Today Deliveries" value={todayTotal}             color="#f59e0b"    icon="bicycle-outline" />
            </View>

            <View style={s.summaryRow}>
              <SummaryItem label="Total Deliveries" value={totalDelivery} />
              <View style={s.sumDivider} />
              <SummaryItem label="Total Rider Earnings" value={totalEarning} color={PRIMARY} />
            </View>
          </>
        )}

        {/* ── On duty today ── */}
        {overview && overview.today.length > 0 && (
          <>
            <Text style={s.sectionTitle}>On Duty Today</Text>
            <View style={s.dutyBox}>
              {overview.today.map((name, i) => (
                <View key={i} style={s.dutyChip}>
                  <View style={s.dutyDot} />
                  <Text style={s.dutyName}>{name}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Rider cards ── */}
        <Text style={s.sectionTitle}>Rider Performance</Text>

        {riders.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={52} color="#e5e7eb" />
            <Text style={s.emptyText}>No riders found</Text>
            <Text style={s.emptyHint}>Add riders from the Delivery Staff page</Text>
          </View>
        ) : (
          riders
            .slice()
            .sort((a, b) => b.total_delivery - a.total_delivery)
            .map((rider, i) => (
              <TouchableOpacity
                key={rider.id}
                style={s.riderCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/rider-payout?rider_id=${rider.id}&rider_name=${encodeURIComponent(rider.name)}` as any)}
              >
                {/* Rider head */}
                <View style={s.riderHead}>
                  <View style={s.avatarWrap}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{initials(rider.name)}</Text>
                    </View>
                    {rider.status === 0 && <View style={s.onlineDot} />}
                  </View>
                  <View style={s.riderInfo}>
                    <Text style={s.riderName}>{rider.name}</Text>
                    <Text style={s.riderPhone}>{rider.phone}</Text>
                  </View>
                  <View style={[s.rankPill, { backgroundColor: i < 3 ? (PRIMARY + '18') : '#f3f4f6' }]}>
                    <Text style={[s.rankText, { color: i < 3 ? PRIMARY : '#9ca3af' }]}>#{i + 1}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color="#ccc" style={{ marginLeft: 4 }} />
                </View>

                {/* Stats row */}
                <View style={s.statsGrid}>
                  <GridStat label="Today" value={rider.today_delivery} />
                  <GridStat label="Total"   value={rider.total_delivery} />
                  <GridStat label="Earned"  value={rider.earning}        color={PRIMARY} />
                  <GridStat label="Balance" value={rider.balance}        color={rider.balance > 0 ? '#f59e0b' : '#9ca3af'} />
                </View>

                {/* Progress bar (total deliveries share) */}
                {totalDelivery > 0 && (
                  <View style={s.shareRow}>
                    <Text style={s.shareLabel}>Share of total deliveries</Text>
                    <View style={s.shareTrack}>
                      <View style={[s.shareBar, { width: `${(rider.total_delivery / totalDelivery) * 100}%` }]} />
                    </View>
                    <Text style={s.sharePct}>{Math.round((rider.total_delivery / totalDelivery) * 100)}%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) => (
  <View style={s.statCard}>
    <View style={[s.statIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[s.statVal, { color }]}>{value}</Text>
    <Text style={s.statLbl}>{label}</Text>
  </View>
);

const SummaryItem = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <View style={s.sumItem}>
    <Text style={[s.sumVal, color ? { color } : {}]}>{value}</Text>
    <Text style={s.sumLabel}>{label}</Text>
  </View>
);

const GridStat = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <View style={s.gridStat}>
    <Text style={[s.gridStatVal, color ? { color } : {}]}>{value}</Text>
    <Text style={s.gridStatLabel}>{label}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f7' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  scroll:      { padding: 16, paddingBottom: 48 },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },

  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIcon:  { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statVal:   { fontSize: 20, fontWeight: '900', marginBottom: 3 },
  statLbl:   { fontSize: 10, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },

  summaryRow:  { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sumItem:     { flex: 1, alignItems: 'center' },
  sumDivider:  { width: 1, backgroundColor: '#f3f4f6', marginVertical: 4 },
  sumVal:      { fontSize: 22, fontWeight: '900', color: '#1a1a1a', marginBottom: 4 },
  sumLabel:    { fontSize: 11, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },

  dutyBox:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  dutyChip:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  dutyDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  dutyName:  { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },

  riderCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  riderHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarWrap:{ position: 'relative', marginRight: 12 },
  avatar:    { width: 46, height: 46, borderRadius: 23, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  avatarText:{ fontSize: 15, fontWeight: '800', color: PRIMARY },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  riderInfo: { flex: 1 },
  riderName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  riderPhone:{ fontSize: 12, color: '#9ca3af' },
  rankPill:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  rankText:  { fontSize: 12, fontWeight: '800' },

  statsGrid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12, marginBottom: 10 },
  gridStat:  { flex: 1, alignItems: 'center' },
  gridStatVal:  { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  gridStatLabel:{ fontSize: 10, color: '#9ca3af', fontWeight: '600' },

  shareRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareLabel: { fontSize: 10, color: '#bbb', width: 110 },
  shareTrack: { flex: 1, height: 5, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  shareBar:   { height: '100%', backgroundColor: PRIMARY, borderRadius: 3, minWidth: 4 },
  sharePct:   { fontSize: 11, fontWeight: '700', color: PRIMARY, width: 30, textAlign: 'right' },

  emptyBox:  { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#bbb', marginTop: 14 },
  emptyHint: { fontSize: 13, color: '#d1d5db', marginTop: 4 },
});
