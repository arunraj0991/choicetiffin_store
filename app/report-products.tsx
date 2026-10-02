import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { storeProductReport } from '@/src/api/api';

const PRIMARY = COLORS.primary;

type Product = { meal_id: number; meal_name: string; img: string | null; price: number; orders: number };
type CatBlock = { category: string; total_orders: number; top_products: Product[] };

const FILTERS: { label: string; value: number | undefined }[] = [
  { label: 'All Time',   value: undefined },
  { label: 'Last 30d',   value: 30 },
  { label: 'Last 60d',   value: 60 },
  { label: 'Last 180d',  value: 180 },
];

const RANK_COLORS = [PRIMARY, '#f59e0b', '#6b7280'];

export default function ReportProductsScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data,       setData]       = useState<CatBlock[]>([]);
  const [filter,     setFilter]     = useState<number | undefined>(undefined);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await storeProductReport(filter);
      setData(res.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load product report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const totalOrders = data.reduce((s, c) => s + c.total_orders, 0);

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Product Report</Text>
          {!loading && <Text style={s.headerSub}>{totalOrders} total orders across {data.length} categories</Text>}
        </View>
      </View>

      {/* Filter bar */}
      <View style={s.filterBar}>
        {FILTERS.map((f, i) => (
          <TouchableOpacity
            key={i}
            style={[s.chip, filter === f.value && s.chipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY} />}
          >
            {data.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="restaurant-outline" size={52} color="#e5e7eb" />
                <Text style={s.emptyText}>No product data yet</Text>
                <Text style={s.emptyHint}>Orders will appear here once placed</Text>
              </View>
            ) : (
              <>
                {/* ── Overall top products ── */}
                <Text style={s.sectionTitle}>Top Products Overall</Text>
                <View style={s.topBox}>
                  {data.flatMap(c => c.top_products)
                    .sort((a, b) => b.orders - a.orders)
                    .slice(0, 5)
                    .map((p, i) => (
                      <View key={p.meal_id} style={[s.topRow, i === 4 && { borderBottomWidth: 0 }]}>
                        <View style={[s.rankBadge, { backgroundColor: RANK_COLORS[i] || '#e5e7eb' }]}>
                          <Text style={s.rankText}>#{i + 1}</Text>
                        </View>
                        <View style={s.topInfo}>
                          <Text style={s.topName}>{p.meal_name}</Text>
                          <Text style={s.topPrice}>{p.price}</Text>
                        </View>
                        <View style={s.ordersPill}>
                          <Text style={s.ordersVal}>{p.orders}</Text>
                          <Text style={s.ordersSub}>orders</Text>
                        </View>
                      </View>
                    ))
                  }
                </View>

                {/* ── Per category ── */}
                <Text style={s.sectionTitle}>By Category</Text>
                {data.map((cat, ci) => {
                  const pct = totalOrders > 0 ? Math.round((cat.total_orders / totalOrders) * 100) : 0;
                  return (
                    <View key={ci} style={s.catCard}>
                      {/* category header */}
                      <View style={s.catHeader}>
                        <View style={s.catIconWrap}>
                          <Ionicons name="restaurant-outline" size={16} color={PRIMARY} />
                        </View>
                        <View style={s.catInfo}>
                          <Text style={s.catName}>{cat.category}</Text>
                          <View style={s.catProgress}>
                            <View style={s.catTrack}>
                              <View style={[s.catBar, { width: `${pct}%` }]} />
                            </View>
                            <Text style={s.catPct}>{pct}%</Text>
                          </View>
                        </View>
                        <View style={s.catOrderBadge}>
                          <Text style={s.catOrderVal}>{cat.total_orders}</Text>
                          <Text style={s.catOrderSub}>orders</Text>
                        </View>
                      </View>

                      {/* top products */}
                      {cat.top_products.map((p, pi) => (
                        <View key={p.meal_id} style={[s.productRow, pi === cat.top_products.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={[s.productRank, { backgroundColor: (RANK_COLORS[pi] || '#e5e7eb') + '20' }]}>
                            <Text style={[s.productRankText, { color: RANK_COLORS[pi] || '#9ca3af' }]}>#{pi + 1}</Text>
                          </View>
                          <View style={s.productMeta}>
                            <Text style={s.productName}>{p.meal_name}</Text>
                            <Text style={s.productPrice}>{p.price}</Text>
                          </View>
                          <View style={s.productOrders}>
                            <Text style={s.productOrdersVal}>{p.orders}</Text>
                            <Text style={s.productOrdersSub}>orders</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        )
      }
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f7' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  filterBar:       { flexDirection: 'row', gap: 8, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  chip:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive:      { backgroundColor: '#ede9fe', borderColor: PRIMARY },
  chipText:        { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  chipTextActive:  { color: PRIMARY },

  scroll:      { padding: 16, paddingBottom: 48 },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },

  topBox:     { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  topRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rankBadge:  { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rankText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  topInfo:    { flex: 1 },
  topName:    { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  topPrice:   { fontSize: 11, color: '#9ca3af' },
  ordersPill: { alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  ordersVal:  { fontSize: 16, fontWeight: '900', color: '#16a34a' },
  ordersSub:  { fontSize: 9,  fontWeight: '600', color: '#16a34a' },

  catCard:    { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  catHeader:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  catIconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  catInfo:    { flex: 1 },
  catName:    { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 5 },
  catProgress:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  catTrack:   { flex: 1, height: 5, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  catBar:     { height: '100%', backgroundColor: PRIMARY, borderRadius: 3, minWidth: 4 },
  catPct:     { fontSize: 11, fontWeight: '700', color: PRIMARY, width: 30 },
  catOrderBadge: { alignItems: 'center' },
  catOrderVal:   { fontSize: 20, fontWeight: '900', color: PRIMARY },
  catOrderSub:   { fontSize: 10, color: '#9ca3af', fontWeight: '600' },

  productRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  productRank:     { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  productRankText: { fontSize: 11, fontWeight: '800' },
  productMeta:     { flex: 1 },
  productName:     { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  productPrice:    { fontSize: 11, color: '#9ca3af' },
  productOrders:   { alignItems: 'center' },
  productOrdersVal:{ fontSize: 16, fontWeight: '800', color: '#374151' },
  productOrdersSub:{ fontSize: 9, color: '#9ca3af', fontWeight: '600' },

  emptyBox:  { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#bbb', marginTop: 14 },
  emptyHint: { fontSize: 13, color: '#d1d5db', marginTop: 4 },
});
