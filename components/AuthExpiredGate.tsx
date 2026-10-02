import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';
import { AUTH_EXPIRED_EVENT } from '@/src/authSession';
import { useLanguage } from '@/src/i18n/context';

export default function AuthExpiredGate() {
  const router = useRouter();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_EXPIRED_EVENT, () => {
      setVisible(true);
    });
    return () => sub.remove();
  }, []);

  const goLogin = () => {
    setVisible(false);
    router.replace('/login' as any);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={goLogin}>
      <View style={styles.root}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="error-outline" size={42} color={COLORS.danger} />
        </View>
        <Text style={styles.title}>{t('sessionExpiredTitle')}</Text>
        <Text style={styles.message}>{t('sessionExpiredMessage')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={goLogin} activeOpacity={0.85}>
          <Text style={styles.retryText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
  },
  retryBtn: {
    minWidth: 160,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
