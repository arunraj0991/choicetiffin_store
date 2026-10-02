import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import DateRangeCalendarModal, { toApiDate } from '@/components/DateRangeCalendarModal';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import COLORS from '@/constants/colors';
import { storeEarning } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

function formatDateLabel(d: Date) {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

function formatRangeLabel(start: Date, end: Date) {
  return `${formatDateLabel(start)} – ${formatDateLabel(end)}`;
}

type EarningItem = {
  delivery_id?: number | string;
  order_id?: string | null;
  delivery_date?: string | null;
  status_date?: string | null;
  store_fee?: number | string | null;
  meal_type?: string | null;
  meal_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  [key: string]: any;
};

type Totals = {
  totalEarning: number;
  totalPaid: number;
  totalPenalties: number;
  totalIncentives: number;
};

function parseList(res: any): EarningItem[] {
  const page = res?.data;
  const raw = page?.data ?? res?.list ?? [];
  return Array.isArray(raw) ? raw : [];
}

function parseTotals(res: any): Totals | null {
  const raw = res?.summary;
  if (!raw || typeof raw !== 'object') return null;
  return {
    totalEarning: Number(raw.total_earning ?? 0),
    totalPaid: Number(raw.total_paid ?? 0),
    totalPenalties: Number(raw.total_penalties ?? 0),
    totalIncentives: Number(raw.total_incentives ?? 0),
  };
}

function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDay(raw?: string | null) {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EarningPage() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [list, setList] = useState<EarningItem[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async (
    refresh = false,
    rangeOverride?: { from: Date | null; to: Date | null } | null,
  ) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const from = rangeOverride ? rangeOverride.from : fromDate;
    const to = rangeOverride ? rangeOverride.to : toDate;
    try {
      const res = await storeEarning(
        from && to
          ? { from_date: toApiDate(from), to_date: toApiDate(to) }
          : undefined,
      );
      setTotals(parseTotals(res));
      setList(parseList(res));
    } catch {
      setTotals(null);
      setList([]);
      Alert.alert(t('error'), t('failedLoadEarnings'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('earning')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.filterBar}>
        <TouchableOpacity style={s.filterBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
          <View style={s.filterIconWrap}>
            <MaterialIcons name="date-range" size={18} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.filterLabel}>{t('selectDateRange')}</Text>
            <Text style={s.filterValue}>
              {fromDate && toDate ? formatRangeLabel(fromDate, toDate) : t('allDates')}
            </Text>
          </View>
          <MaterialIcons name="keyboard-arrow-down" size={22} color={PRIMARY} />
        </TouchableOpacity>
        {!!(fromDate && toDate) && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => {
              setFromDate(null);
              setToDate(null);
              load(true, { from: null, to: null });
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="close" size={16} color="#64748b" />
            <Text style={s.clearText}>{t('clear')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
        >
          {totals && (
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>{t('totalEarned')}</Text>
                <Text style={[s.statValue, totals.totalEarning < 0 && s.negative]}>
                  {formatMoney(totals.totalEarning)}
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>{t('totalPaid')}</Text>
                <Text style={s.statValue}>{formatMoney(totals.totalPaid)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>{t('totalPenalties')}</Text>
                <Text style={[s.statValue, s.penalty]}>{formatMoney(totals.totalPenalties)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>{t('totalIncentives')}</Text>
                <Text style={[s.statValue, s.incentive]}>{formatMoney(totals.totalIncentives)}</Text>
              </View>
            </View>
          )}

          <Text style={s.sectionTitle}>{t('allEarnings')}</Text>

          {list.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyText}>{t('noEarningsYet')}</Text>
              <Text style={s.emptyHint}>{t('earningsAppearHere')}</Text>
            </View>
          ) : (
            list.map((item, i) => (
              <View key={String(item.delivery_id ?? item.order_id ?? i)} style={s.card}>
                <View style={s.cardLeft}>
                  <Text style={s.amount}>{formatMoney(item.store_fee)}</Text>
                  <Text style={s.title}>
                    {String(item.meal_name || t('earning')).trim()}
                    {item.meal_type ? ` · ${item.meal_type}` : ''}
                  </Text>
                  {!!item.customer_name && (
                    <Text style={s.meta}>
                      {item.customer_name}
                      {item.customer_phone ? ` · ${item.customer_phone}` : ''}
                    </Text>
                  )}
                  <Text style={s.date}>{formatDay(item.delivery_date)}</Text>
                  {!!item.order_id && (
                    <Text style={s.orderId}>#{item.order_id}</Text>
                  )}
                </View>
                <View style={s.iconWrap}>
                  <MaterialIcons name="payments" size={22} color={PRIMARY} />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <DateRangeCalendarModal
        visible={showDatePicker}
        start={fromDate}
        end={toDate}
        maxDate={new Date()}
        onClose={() => setShowDatePicker(false)}
        onApply={(start, end) => {
          setFromDate(start);
          setToDate(end);
          load(true, { from: start, to: end });
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: PRIMARY,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },

  filterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 2 },
  filterValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  clearBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: { fontSize: 12, fontWeight: '700', color: '#64748b' },

  scroll: { padding: 16, paddingBottom: 40 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  negative: { color: '#dc2626' },
  penalty: { color: '#dc2626' },
  incentive: { color: '#16a34a' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1, marginRight: 12 },
  amount: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  title: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 2 },
  meta: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  date: { fontSize: 12, color: '#9ca3af' },
  orderId: { fontSize: 11, color: '#cbd5e1', marginTop: 2 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#cbd5e1', marginTop: 4 },
});
