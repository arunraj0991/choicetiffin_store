import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';
import { useLanguage } from '@/src/i18n/context';
import { storeResendOtp, storeVerifyEmail } from '@/src/api/api';
import { isStoreApproved } from '@/src/storeApproval';
import { useSafeHeaderPad } from '@/components/SafeScreen';

const PRIMARY = COLORS.primary;

export default function Otp() {
  const headerPad = useSafeHeaderPad();
  const router      = useRouter();
  const { t }       = useLanguage();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();

  const inputs = useRef<Array<TextInput | null>>([]);
  const [otp,       setOtp]       = useState(['', '', '', '']);
  const [timer,     setTimer]     = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return; }
    const id = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleChange = (text: string, index: number) => {
    const next = [...otp];
    next[index] = text;
    setOtp(next);
    if (text && index < 3) inputs.current[index + 1]?.focus();
  };

  const handleBackspace = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const formatTime = (s: number) => {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    try {
      const data = await storeResendOtp(storeId!);
      if (data.msg === 'done') {
        setOtp(['', '', '', '']);
        setTimer(30);
        setCanResend(false);
        inputs.current[0]?.focus();
        Alert.alert(t('sent'), t('newCodeSent'));
      } else {
        Alert.alert(t('error'), data.error || t('resendFailed'));
      }
    } catch {
      Alert.alert(t('error'), t('networkError'));
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (!otp.every(v => v.length === 1)) {
      Alert.alert(t('error'), t('enterComplete4Digit'));
      return;
    }
    setVerifying(true);
    try {
      const data = await storeVerifyEmail(storeId!, otp.join(''));
      if (data.msg === 'done') {
        const store = data.store ?? {};
        const approved = isStoreApproved(store);
        await AsyncStorage.multiSet([
          ['store_token', data.token],
          ['store_id',    String(store.id ?? storeId)],
          ['store_name',  store.name ?? ''],
          ['store_email', store.email ?? ''],
          ['store_phone', store.phone ?? ''],
          ['store_approved', approved ? '1' : '0'],
        ]);
        if (approved) {
          Alert.alert(t('successTitle'), t('storeVerified'), [
            { text: t('ok'), onPress: () => router.replace('/(tabs)' as any) },
          ]);
        } else {
          router.replace('/pending-approval' as any);
        }
      } else {
        Alert.alert(t('error'), data.error || t('invalidCode'));
      }
    } catch {
      Alert.alert(t('error'), t('networkError'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: headerPad }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        <View style={styles.iconWrapper}>
          <View style={styles.iconBg}>
            <MaterialIcons name="mark-email-unread" size={40} color={PRIMARY} />
          </View>
        </View>

        <Text style={styles.title}>{t('verifyEmail')}</Text>
        <Text style={styles.subtitle}>{t('otpSubtitle')}</Text>

        <View style={styles.otpRow}>
          {[0, 1, 2, 3].map((_, i) => (
            <TextInput
              key={i}
              ref={ref => { inputs.current[i] = ref; }}
              style={[styles.otpBox, otp[i] ? styles.otpBoxFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
              value={otp[i]}
              onChangeText={v => handleChange(v, i)}
              onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, i)}
              autoFocus={i === 0}
            />
          ))}
        </View>

        {!canResend ? (
          <Text style={styles.timer}>
            {t('resendCodeIn')} <Text style={styles.timerBold}>{formatTime(timer)}</Text>
          </Text>
        ) : (
          <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={resending}>
            {resending
              ? <ActivityIndicator size="small" color={PRIMARY} />
              : <Text style={styles.resendText}>{t('resendCode')}</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btn, verifying && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={verifying}
        >
          {verifying
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.btnText}>{t('verifyContinue')}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.secondary },
  scroll:      { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 32 },

  backBtn:     { marginTop: 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  iconWrapper: { alignItems: 'center', marginTop: 36, marginBottom: 28 },
  iconBg:      { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(74,21,148,0.1)', justifyContent: 'center', alignItems: 'center' },

  title:       { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#111827', marginBottom: 10 },
  subtitle:    { textAlign: 'center', fontSize: 14, color: '#6b7280', lineHeight: 22, marginBottom: 36 },

  otpRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  otpBox:      { height: 58, width: 58, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.border, textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#111827' },
  otpBoxFilled:{ borderColor: PRIMARY },

  timer:       { textAlign: 'center', fontSize: 14, color: '#6b7280', marginBottom: 28 },
  timerBold:   { color: PRIMARY, fontWeight: '700' },

  resendBtn:   { alignSelf: 'center', marginBottom: 28, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, minWidth: 130, alignItems: 'center' },
  resendText:  { color: PRIMARY, fontSize: 14, fontWeight: '600' },

  btn:         { height: 52, backgroundColor: PRIMARY, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
