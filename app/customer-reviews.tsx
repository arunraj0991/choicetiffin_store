import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { storeGetCustomerReviews } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

type ReviewItem = {
  id?: number | string;
  stars?: number | string | null;
  review_text?: string | null;
  meal_name?: string | null;
  customer_name?: string | null;
};

function parseReviewPage(res: any): { list: ReviewItem[]; page: number; lastPage: number; total: number } {
  const pageData = res?.data && typeof res.data === 'object' ? res.data : res;
  const raw = pageData?.data ?? res?.data ?? res;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && (raw.id != null || raw.review_text || raw.stars != null)
      ? [raw]
      : [];

  return {
    list,
    page: Number(pageData?.current_page ?? 1) || 1,
    lastPage: Number(pageData?.last_page ?? 1) || 1,
    total: Number(pageData?.total ?? list.length) || list.length,
  };
}

function reviewRating(item: ReviewItem) {
  const n = Number(item.stars ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <MaterialIcons
          key={i}
          name={i <= rating ? 'star' : 'star-border'}
          size={size}
          color={i <= rating ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </View>
  );
}

export default function CustomerReviewsScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [list, setList] = useState<ReviewItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (nextPage = 1, refresh = false) => {
    if (refresh) setRefreshing(true);
    else if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await storeGetCustomerReviews(nextPage);
      const parsed = parseReviewPage(res);
      setList(prev => (nextPage === 1 ? parsed.list : [...prev, ...parsed.list]));
      setPage(parsed.page);
      setLastPage(parsed.lastPage);
      setTotal(parsed.total);
    } catch {
      if (nextPage === 1) {
        setList([]);
        setTotal(0);
      }
      Alert.alert(t('error'), t('failedLoadReviews'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [t]);

  useEffect(() => {
    load(1);
  }, [load]);

  const average = useMemo(() => {
    const ratings = list
      .map(item => Number(item.stars ?? 0))
      .filter(n => Number.isFinite(n) && n > 0);
    if (!ratings.length) return 0;
    return ratings.reduce((sum, n) => sum + n, 0) / ratings.length;
  }, [list]);

  const avgLabel = average > 0 ? average.toFixed(1) : '0.0';

  const renderItem = ({ item }: { item: ReviewItem }) => {
    const rating = reviewRating(item);
    const name = String(item.customer_name || 'Customer').trim();
    const text = String(item.review_text || '').trim();
    const meal = String(item.meal_name || '').trim();

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase() || 'C'}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
            <Stars rating={rating} />
          </View>
        </View>

        {!!meal && <Text style={styles.mealName} numberOfLines={1}>{meal}</Text>}
        {!!text && <Text style={styles.reviewText}>{text}</Text>}
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
        <Text style={styles.headerTitle}>{t('customerReviews')}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!loadingMore && !refreshing && page < lastPage) {
              load(page + 1);
            }
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>{t('averageRating')}</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{avgLabel}</Text>
                  <Stars rating={Math.round(average)} size={18} />
                </View>
                <Text style={styles.summaryCount}>
                  {total} {t('reviewsCount')}
                </Text>
              </View>
              <View style={styles.summaryIcon}>
                <MaterialIcons name="rate-review" size={24} color={PRIMARY} />
              </View>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={PRIMARY} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="rate-review" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t('noCustomerReviews')}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 14, paddingBottom: 40, flexGrow: 1 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryValue: { fontSize: 28, fontWeight: '900', color: PRIMARY },
  summaryCount: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: '600' },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  cardMeta: { flex: 1, marginRight: 8 },
  cardName: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  mealName: { marginTop: 10, fontSize: 12, fontWeight: '700', color: '#64748b' },
  reviewText: { marginTop: 8, fontSize: 13, color: '#334155', lineHeight: 19 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94a3b8' },
});
