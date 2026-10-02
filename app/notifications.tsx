import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { useAppRefresh } from '@/src/appRefresh';
import { useLanguage } from '@/src/i18n/context';
import { storeNotifications } from '@/src/api/api';

const PRIMARY = COLORS.primary;

interface NotifItem {
  id:    number;
  title: string;
  text:  string;
  img:   string | null;
  date:  string;
}

export default function NotificationsScreen() {
  const headerPad = useSafeHeaderPad();
  const router   = useRouter();
  const { t }    = useLanguage();

  const [items,      setItems]      = useState<NotifItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(false);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const res = await storeNotifications();
      setItems(res.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useAppRefresh(fetchData);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const renderItem = ({ item, index }: { item: NotifItem; index: number }) => (
    <View style={[styles.card, index === 0 && styles.cardFirst]}>
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="notifications" size={20} color={PRIMARY} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.text} numberOfLines={3}>{item.text}</Text>
        {item.img ? (
          <Image source={{ uri: item.img }} style={styles.img} resizeMode="cover" />
        ) : null}
        <Text style={styles.date}>{item.date}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="wifi-off" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t('failedLoadNotifications')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="notifications-none" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t('noNotificationsYet')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.secondary },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:     { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle:{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },

  list:       { padding: 16, gap: 10 },

  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardFirst:  {},
  cardLeft:   { paddingTop: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center' },
  cardBody:   { flex: 1 },
  title:      { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  text:       { fontSize: 13, color: '#475569', lineHeight: 20 },
  img:        { width: '100%', height: 140, borderRadius: 10, marginTop: 10 },
  date:       { fontSize: 11, color: '#94a3b8', marginTop: 8 },

  emptyText:  { color: '#94a3b8', fontSize: 15, marginTop: 12, marginBottom: 20 },
  retryBtn:   { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: PRIMARY, borderRadius: 12 },
  retryText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
