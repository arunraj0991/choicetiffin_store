import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import {
  storeSaleReport, storeOrderReport, storeProductReport, storeRiderReport,
} from '@/src/api/api';

const PRIMARY = COLORS.primary;

const TABS = ['Sales', 'Orders', 'Products', 'Riders'];

// ── Types ─────────────────────────────────────────────────────────────────────

type SaleData = {
  data: {
    total:      { commission: number; net_earning: number };
    this_month: { commission: number; net_earning: number };
    this_week:  { commission: number; net_earning: number };
  };
  chart:  number[];
  months: string[];
};

type OrderData = {
  data:   { active: number; paused: number; completed: number; cancelled: number; total: number };
  chart:  number[];
  months: string[];
};

type ProductItem = {
  category:     string;
  total_orders: number;
  top_products: { meal_id: number; meal_name: string; img: string | null; price: number; orders: number }[];
};

type RiderItem = {
  id: string; name: string; img: string | null; phone: string; status: number;
  today_delivery: number; total_delivery: number; earning: number; balance: number;
};

type RiderData = {
  data:     RiderItem[];
  overview: { total: number; active: number; today: string[] };
};

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const reversed = [...values].reverse();
  const max      = Math.max(...reversed, 1);
  const BAR_H    = 100;

  return (
    <View style={bc.wrap}>
      <View style={bc.chart}>
        {reversed.map((v, i) => (
          <View key={i} style={bc.barCol}>
            <View style={bc.barTrack}>
              <View style={[bc.bar, { height: (v / max) * BAR_H, backgroundColor: color }]} />
            </View>
            <Text style={bc.barLabel}>{labels[labels.length - 1 - i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  wrap:     { backgroundColor: '#fafafa', borderRadius: 14, padding: 14, marginBottom: 16 },
  chart:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 },
  barCol:   { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '70%', height: 100, justifyContent: 'flex-end' },
  bar:      { width: '100%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9, color: '#aaa', marginTop: 4, fontWeight: '600' },
});

// ── Stat cards ────────────────────────────────────────────────────────────────

function StatRow({ items }: { items: { label: string; value: string | number; color?: string }[] }) {
  return (
    <View style={sr.row}>
      {items.map((item, i) => (
        <View key={i} style={sr.card}>
          <Text style={[sr.value, item.color ? { color: item.color } : {}]}>{item.value}</Text>
          <Text style={sr.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const sr = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  card:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  value: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 3 },
  label: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },
});

// ── Section label ─────────────────────────────────────────────────────────────

const SectionLabel = ({ title }: { title: string }) => (
  <Text style={{ fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 }}>{title}</Text>
);

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const headerPad = useSafeHeaderPad();
  const router  = useRouter();
  const params  = useLocalSearchParams<{ tab?: string }>();
  const initTab = Number(params.tab ?? 0);

  const [tab,        setTab]        = useState(initTab);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saleData,    setSaleData]    = useState<SaleData | null>(null);
  const [orderData,   setOrderData]   = useState<OrderData | null>(null);
  const [productData, setProductData] = useState<ProductItem[]>([]);
  const [riderData,   setRiderData]   = useState<RiderData | null>(null);
  const [productFilter, setProductFilter] = useState<number | undefined>(undefined);

  const loaded = useRef({ 0: false, 1: false, 2: false, 3: false } as Record<number, boolean>);

  const loadTab = useCallback(async (t: number, refresh = false) => {
    if (!refresh && loaded.current[t]) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      if (t === 0) {
        const res = await storeSaleReport();
        setSaleData(res.data);
      } else if (t === 1) {
        const res = await storeOrderReport();
        setOrderData(res.data);
      } else if (t === 2) {
        const res = await storeProductReport(productFilter);
        setProductData(res.data);
      } else if (t === 3) {
        const res = await storeRiderReport();
        setRiderData(res.data);
      }
      loaded.current[t] = true;
    } catch {
      Alert.alert('Error', 'Failed to load report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productFilter]);

  useEffect(() => {
    loaded.current = { 0: false, 1: false, 2: false, 3: false };
    loadTab(tab);
  }, [productFilter]);

  useEffect(() => { loadTab(tab); }, [tab]);

  const switchTab = (t: number) => { setTab(t); loadTab(t); };

  // ── Sales tab ───────────────────────────────────────────────────────────────
  const SalesTab = () => {
    if (!saleData) return null;
    const { data, chart, months } = saleData;
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.tabScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTab(0, true)} tintColor={PRIMARY} />}
      >
        <SectionLabel title="This Week" />
        <StatRow items={[
          { label: 'Net Earning',  value: data.this_week.net_earning,  color: PRIMARY },
          { label: 'Commission',   value: data.this_week.commission,   color: '#ef4444' },
        ]} />

        <SectionLabel title="This Month" />
        <StatRow items={[
          { label: 'Net Earning',  value: data.this_month.net_earning, color: PRIMARY },
          { label: 'Commission',   value: data.this_month.commission,  color: '#ef4444' },
        ]} />

        <SectionLabel title="All Time" />
        <StatRow items={[
          { label: 'Net Earning',  value: data.total.net_earning,      color: PRIMARY },
          { label: 'Commission',   value: data.total.commission,       color: '#ef4444' },
        ]} />

        <SectionLabel title="Last 12 Months — Net Earning" />
        <BarChart values={chart} labels={months} color={PRIMARY} />
      </ScrollView>
    );
  };

  // ── Orders tab ──────────────────────────────────────────────────────────────
  const OrdersTab = () => {
    if (!orderData) return null;
    const { data, chart, months } = orderData;
    const STATUS_COLORS = ['#16a34a', '#f59e0b', '#6b7280', '#ef4444'];
    const statuses = [
      { label: 'Active',    value: data.active,    color: '#16a34a' },
      { label: 'Paused',    value: data.paused,    color: '#f59e0b' },
      { label: 'Completed', value: data.completed, color: '#6b7280' },
      { label: 'Cancelled', value: data.cancelled, color: '#ef4444' },
    ];
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.tabScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTab(1, true)} tintColor={PRIMARY} />}
      >
        <SectionLabel title="Overview" />
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Total Orders</Text>
          <Text style={s.totalValue}>{data.total}</Text>
        </View>

        <View style={s.orderGrid}>
          {statuses.map((st, i) => (
            <View key={i} style={[s.orderGridCard, { borderTopColor: st.color, borderTopWidth: 3 }]}>
              <Text style={[s.orderGridVal, { color: st.color }]}>{st.value}</Text>
              <Text style={s.orderGridLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* progress bars */}
        {statuses.map((st, i) => (
          <View key={i} style={s.progressRow}>
            <Text style={s.progressLabel}>{st.label}</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressBar, {
                width: data.total > 0 ? `${(st.value / data.total) * 100}%` : '0%',
                backgroundColor: st.color,
              }]} />
            </View>
            <Text style={[s.progressPct, { color: st.color }]}>
              {data.total > 0 ? Math.round((st.value / data.total) * 100) : 0}%
            </Text>
          </View>
        ))}

        <SectionLabel title="Last 12 Months — Orders" />
        <BarChart values={chart} labels={months} color="#6366f1" />
      </ScrollView>
    );
  };

  // ── Products tab ─────────────────────────────────────────────────────────────
  const ProductsTab = () => {
    const FILTERS = [
      { label: 'All Time',    value: undefined },
      { label: 'Last 30d',   value: 30 },
      { label: 'Last 60d',   value: 60 },
      { label: 'Last 180d',  value: 180 },
    ];
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.tabScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTab(2, true)} tintColor={PRIMARY} />}
      >
        {/* filter chips */}
        <View style={s.filterRow}>
          {FILTERS.map((f, i) => (
            <TouchableOpacity
              key={i}
              style={[s.filterChip, productFilter === f.value && s.filterChipActive]}
              onPress={() => setProductFilter(f.value)}
            >
              <Text style={[s.filterChipText, productFilter === f.value && s.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {productData.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="restaurant-outline" size={44} color="#e5e7eb" />
            <Text style={s.emptyText}>No product data yet</Text>
          </View>
        ) : (
          productData.map((cat, ci) => (
            <View key={ci} style={s.catBlock}>
              <View style={s.catHeader}>
                <View style={s.catDot} />
                <Text style={s.catName}>{cat.category}</Text>
                <View style={s.catBadge}>
                  <Text style={s.catBadgeText}>{cat.total_orders} orders</Text>
                </View>
              </View>
              {cat.top_products.map((p, pi) => (
                <View key={pi} style={s.productRow}>
                  <Text style={s.productRank}>#{pi + 1}</Text>
                  <View style={s.productInfo}>
                    <Text style={s.productName}>{p.meal_name}</Text>
                    <Text style={s.productPrice}>{p.price}</Text>
                  </View>
                  <View style={s.productOrderBadge}>
                    <Text style={s.productOrderText}>{p.orders}</Text>
                    <Text style={s.productOrderSub}>orders</Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // ── Riders tab ───────────────────────────────────────────────────────────────
  const RidersTab = () => {
    if (!riderData) return null;
    const { data, overview } = riderData;
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.tabScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTab(3, true)} tintColor={PRIMARY} />}
      >
        <SectionLabel title="Overview" />
        <StatRow items={[
          { label: 'Total Riders',  value: overview.total,  color: PRIMARY },
          { label: 'Active Riders', value: overview.active, color: '#16a34a' },
          { label: 'On Duty Today', value: overview.today.length, color: '#f59e0b' },
        ]} />

        {overview.today.length > 0 && (
          <View style={s.todayBox}>
            <Text style={s.todayTitle}>Riders On Duty Today</Text>
            <View style={s.todayNames}>
              {overview.today.map((name, i) => (
                <View key={i} style={s.todayChip}>
                  <View style={s.todayDot} />
                  <Text style={s.todayChipText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <SectionLabel title="Rider Performance" />
        {data.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={44} color="#e5e7eb" />
            <Text style={s.emptyText}>No riders found</Text>
          </View>
        ) : (
          data.map((rider, i) => (
            <TouchableOpacity
              key={rider.id}
              style={s.riderCard}
              onPress={() => router.push(`/rider-payout?rider_id=${rider.id}&rider_name=${encodeURIComponent(rider.name)}` as any)}
              activeOpacity={0.8}
            >
              <View style={s.riderHead}>
                <View style={s.riderAvatarWrap}>
                  <View style={s.riderAvatar}>
                    <Text style={s.riderInitials}>
                      {rider.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
                  </View>
                  {rider.status === 0 && <View style={s.riderOnlineDot} />}
                </View>
                <View style={s.riderInfo}>
                  <Text style={s.riderName}>{rider.name}</Text>
                  <Text style={s.riderPhone}>{rider.phone}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color="#ccc" />
              </View>
              <View style={s.riderStats}>
                <RiderStat label="Today" value={rider.today_delivery} />
                <RiderStat label="Total" value={rider.total_delivery} />
                <RiderStat label="Earned" value={rider.earning} color={PRIMARY} />
                <RiderStat label="Balance" value={rider.balance} color={rider.balance > 0 ? '#f59e0b' : '#9ca3af'} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  // ── Screen ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reports</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={i} style={[s.tabBtn, tab === i && s.tabBtnActive]} onPress={() => switchTab(i)}>
            <Text style={[s.tabBtnText, tab === i && s.tabBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
        : <>
            {tab === 0 && <SalesTab />}
            {tab === 1 && <OrdersTab />}
            {tab === 2 && <ProductsTab />}
            {tab === 3 && <RidersTab />}
          </>
      }
    </View>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

const RiderStat = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <View style={{ alignItems: 'center', flex: 1 }}>
    <Text style={{ fontSize: 16, fontWeight: '800', color: color || '#1a1a1a' }}>{value}</Text>
    <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>{label}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f5f5f7' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  tabBar:          { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabBtn:          { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  tabBtnActive:    { backgroundColor: PRIMARY },
  tabBtnText:      { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  tabBtnTextActive:{ color: '#fff' },

  tabScroll: { padding: 16, paddingBottom: 48 },

  // Orders tab
  totalCard:  { backgroundColor: PRIMARY, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  totalValue: { color: '#fff', fontSize: 38, fontWeight: '900' },

  orderGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  orderGridCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  orderGridVal:  { fontSize: 28, fontWeight: '900', marginBottom: 4 },
  orderGridLabel:{ fontSize: 12, color: '#9ca3af', fontWeight: '600' },

  progressRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  progressLabel: { width: 72, fontSize: 12, color: '#6b7280', fontWeight: '600' },
  progressTrack: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  progressBar:   { height: '100%', borderRadius: 4, minWidth: 4 },
  progressPct:   { width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Products tab
  filterRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive:   { backgroundColor: '#ede9fe', borderColor: PRIMARY },
  filterChipText:     { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: PRIMARY },

  catBlock:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  catHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  catDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  catName:       { flex: 1, fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  catBadge:      { backgroundColor: '#ede9fe', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText:  { fontSize: 11, fontWeight: '700', color: PRIMARY },
  productRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  productRank:   { fontSize: 13, fontWeight: '800', color: '#d1d5db', width: 28 },
  productInfo:   { flex: 1 },
  productName:   { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  productPrice:  { fontSize: 12, color: '#9ca3af' },
  productOrderBadge: { alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  productOrderText:  { fontSize: 15, fontWeight: '900', color: '#16a34a' },
  productOrderSub:   { fontSize: 9, color: '#16a34a', fontWeight: '600' },

  // Riders tab
  todayBox:      { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  todayTitle:    { fontSize: 12, fontWeight: '700', color: '#16a34a', marginBottom: 10 },
  todayNames:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  todayChip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  todayDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  todayChipText: { fontSize: 12, fontWeight: '600', color: '#1a1a1a' },

  riderCard:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  riderHead:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  riderAvatarWrap: { position: 'relative', marginRight: 12 },
  riderAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  riderInitials:   { fontSize: 15, fontWeight: '800', color: PRIMARY },
  riderOnlineDot:  { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  riderInfo:       { flex: 1 },
  riderName:       { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  riderPhone:      { fontSize: 12, color: '#9ca3af' },
  riderStats:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },

  emptyBox:  { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#bbb', marginTop: 12 },
});
