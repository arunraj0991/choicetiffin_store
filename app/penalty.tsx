import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { storeGetPenalties } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

type PenaltyItem = {
  id: number | string;
  title?: string | null;
  type?: string | null;
  penalty_type?: string | null;
  reason?: string | null;
  amount?: number | string | null;
  status?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  date?: string | null;
};

function parsePenaltyList(res: any): PenaltyItem[] {
  const raw = res?.data?.data ?? res?.data?.list ?? res?.data?.penalties ?? res?.data ?? res?.list ?? res?.penalties ?? res;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw.id != null || raw.reason != null || raw.amount != null)) {
    return [raw];
  }
  return [];
}

function parseTotalPenalty(res: any): number {
  const value =
    res?.data?.total_penalty
    ?? res?.total_penalty
    ?? res?.data?.totalPenalty
    ?? res?.data?.total;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(status?: string | number | null) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === '1' || s === 'approved' || s === 'accepted' || s === 'paid') {
    return { bg: '#dcfce7', text: '#16a34a', label: 'Approved' };
  }
  if (s === '2' || s === 'declined' || s === 'rejected' || s === 'cancelled') {
    return { bg: '#fee2e2', text: '#dc2626', label: 'Declined' };
  }
  return { bg: '#fef3c7', text: '#d97706', label: s || 'Pending' };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}



export default function PenaltyScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [list, setList] = useState<PenaltyItem[]>([]);
  const [search, setSearch] = useState('');
  const [totalPenalty, setTotalPenalty] = useState(0);
  const [currency, setCurrency] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await storeGetPenalties();
      setList(parsePenaltyList(res));
      setTotalPenalty(parseTotalPenalty(res));
      setCurrency(String(res?.data?.currency ?? res?.currency ?? ''));
    } catch {
      setList([]);
      setTotalPenalty(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(item => String(item.reason ?? '').toLowerCase().includes(q));
  }, [list, search]);

  const renderItem = ({ item }: { item: PenaltyItem }) => {
    const st = normalizeStatus(item.status);
    const amount = item.amount != null && item.amount !== '' ? `${currency}${item.amount}` : null;
    const reason = item.reason ? String(item.reason) : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
         
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle} numberOfLines={3}>{reason}</Text>
            <Text style={styles.cardDate}>{formatDate(item.date || item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>
        {!!amount && <Text style={styles.cardAmount}>{amount}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('penalty')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.topBlock}>
        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>{t('totalPenalty')}</Text>
            <Text style={styles.totalValue}>{currency}{totalPenalty}</Text>
          </View>
          <View style={styles.totalIcon}>
            <MaterialIcons name="account-balance-wallet" size={24} color={PRIMARY} />
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchPenaltyReason')}
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {search.trim() ? t('noPenaltySearch') : t('noPenalties')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.secondary },
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
  topBlock: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0ebff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  totalLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  totalValue: { fontSize: 24, fontWeight: '900', color: PRIMARY },
  totalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 14, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  cardDate: { fontSize: 12, color: '#94a3b8' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardReason: { marginTop: 10, fontSize: 13, color: '#64748b', lineHeight: 18 },
  cardAmount: { marginTop: 8, fontSize: 16, fontWeight: '800', color: PRIMARY },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94a3b8' },
});
