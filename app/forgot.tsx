import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
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
import { storeForgot } from '@/src/api/api';
import { useSafeHeaderPad } from '@/components/SafeScreen';

const PRIMARY = COLORS.primary;

export default function Forgot() {
  const headerPad = useSafeHeaderPad();
  const router   = useRouter();
  const { t }    = useLanguage();

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string | null>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())                     e.email = t('emailRequired');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('validEmail');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await storeForgot(email.trim().toLowerCase());
      if (data.msg === 'done') {
        Alert.alert(
          t('emailSent'),
          t('resetLinkSent'),
          [{ text: t('ok'), onPress: () => router.replace('/login' as any) }]
        );
      } else {
        Alert.alert(t('error'), data.error || t('sendResetFailed'));
      }
    } catch {
      Alert.alert(t('error'), t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: headerPad }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.logoWrapper}>
          <View style={styles.logoBox}>
            <MaterialIcons name="lock-reset" size={48} color={PRIMARY} />
          </View>
        </View>

        <Text style={styles.title}>{t('forgotPasswordTitle')}</Text>
        <Text style={styles.subtitle}>{t('forgotSubtitle')}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('emailAddress')}</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder={t('storePlaceholder')}
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={v => { setEmail(v); if (errors.email) setErrors(p => ({ ...p, email: null })); }}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.btnText}>{t('sendResetLink')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace('/login' as any)}>
          <MaterialIcons name="arrow-back" size={16} color={PRIMARY} />
          <Text style={styles.backToLoginText}> {t('backToLogin')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.secondary },
  scroll:          { flexGrow: 1, paddingHorizontal: 24 },

  header:          { paddingVertical: 16 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  logoWrapper:     { alignItems: 'center', marginVertical: 30 },
  logoBox:         { width: 96, height: 96, borderRadius: 20, backgroundColor: 'rgba(74,21,148,0.1)', justifyContent: 'center', alignItems: 'center' },

  title:           { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 12 },
  subtitle:        { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  inputGroup:      { marginBottom: 24 },
  label:           { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#111827' },
  input:           { height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', paddingHorizontal: 16, fontSize: 15, color: '#111827' },
  inputError:      { borderColor: COLORS.danger, borderWidth: 1.5 },
  errorText:       { color: COLORS.danger, fontSize: 12, marginTop: 4, marginLeft: 4 },

  btn:             { height: 48, borderRadius: 20, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  btnDisabled:     { backgroundColor: '#9ca3af' },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '700' },

  backToLogin:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  backToLoginText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
});
