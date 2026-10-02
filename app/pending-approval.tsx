import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { getApproval } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

export default function PendingApproval() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [storeName, setStoreName] = useState('Store');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('store_name').then(n => {
      if (n) setStoreName(n);
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getApproval();
      const data = res?.data ?? {};
      if (data.name) {
        setStoreName(String(data.name));
        await AsyncStorage.setItem('store_name', String(data.name));
      }
      if (data.is_approved === true || data.is_approved === 1 || data.is_approved === '1') {
        await AsyncStorage.setItem('store_approved', '1');
        router.replace('/(tabs)' as any);
        return;
      }
      await AsyncStorage.setItem('store_approved', '0');
      Alert.alert(t('pendingApprovalTitle'), t('stillPendingApproval'));
    } catch {
      Alert.alert(t('error'), t('networkError'));
    } finally {
      setRefreshing(false);
    }
  }, [router, t]);

  return (
    <View style={[styles.root, { paddingTop: headerPad }]}>
      <StatusBar style="dark" />

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="hourglass-top" size={42} color={PRIMARY} />
        </View>

        <Text style={styles.title}>{t('pendingApprovalTitle')}</Text>
        <Text style={styles.storeName}>
          {storeName} {t('pendingForApproval')}
        </Text>
        <Text style={styles.message}>{t('pendingApprovalHint')}</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
          onPress={onRefresh}
          disabled={refreshing}
          activeOpacity={0.85}
        >
          {refreshing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="refresh" size={20} color="#fff" />
              <Text style={styles.refreshText}>{t('refresh')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 28,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#f0ebff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    paddingBottom: 55,
  },
  refreshBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  refreshText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
