import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { storeLogin } from '@/src/api/api';
import { isStoreApproved } from '@/src/storeApproval';
import { useLanguage } from '@/src/i18n/context';
import { OneSignal } from '@/src/onesignal';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = COLORS.primary;

export default function Login() {
  const router    = useRouter();
  const { t }     = useLanguage();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string | null>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())                     e.email    = t('emailRequired');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email    = t('validEmail');
    if (!password.trim())                  e.password = t('passwordRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await storeLogin(email.trim().toLowerCase(), password);

      const responseData = data.data || data;

      if (responseData.msg === 'done') {
        const storeOrUser = responseData.store || responseData.user;
        const approved = isStoreApproved(storeOrUser);
        OneSignal?.login(String(storeOrUser.id));
        OneSignal?.User.addTag('user_id', String(storeOrUser.id));
        await AsyncStorage.multiSet([
          ['store_token', responseData.token],
          ['store_id',    String(storeOrUser.id)],
          ['store_name',  storeOrUser.name],
          ['store_email', storeOrUser.email],
          ['store_phone', storeOrUser.phone],
          ['store_approved', approved ? '1' : '0'],
        ]);
        router.replace((approved ? '/(tabs)' : '/pending-approval') as any);
      } else {
        Alert.alert(t('error'), responseData.error || t('loginFailed'));
      }
    } catch {
      Alert.alert(t('error'), t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['bottom']}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      {/* Hero image */}
      <View style={styles.imageWrapper}>
        <Image source={require('@/assets/images/login.png')} style={styles.image} />
        <View style={styles.overlay} />
        <View style={styles.brand}>
          <View style={styles.brandRow}>
            <MaterialIcons name="storefront" size={28} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.brandTitle}>{t('vendorApp')}</Text>
          </View>
          <Text style={styles.brandSub}>{t('manageStoreTagline')}</Text>
        </View>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <ScrollView
          contentContainerStyle={styles.cardScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>{t('welcomeBack')}</Text>
          <Text style={styles.subHeading}>{t('signInManageStore')}</Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              placeholder={t('emailPlaceholder')}
              placeholderTextColor="#94a3b8"
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={v => { setEmail(v); if (errors.email) setErrors(p => ({ ...p, email: null })); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('password')}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                style={[styles.passwordInput, errors.password && styles.inputError]}
                value={password}
                onChangeText={v => { setPassword(v); if (errors.password) setErrors(p => ({ ...p, password: null })); }}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPass(!showPass)}>
                <MaterialIcons name={showPass ? 'visibility' : 'visibility-off'} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <TouchableOpacity style={styles.forgotWrap} onPress={() => router.push('/forgot' as any)}>
            <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnText}>{t('logIn')}</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('noAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/signup' as any)}>
              <Text style={styles.footerLink}>{t('signUp')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f8fafc' },

  imageWrapper:  { height: '38%', position: 'relative' },
  image:         { width: '100%', height: '100%', resizeMode: 'cover' },
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(74,21,148,0.75)' },
  brand:         { position: 'absolute', bottom: 30, left: 24 },
  brandRow:      { flexDirection: 'row', alignItems: 'center' },
  brandTitle:    { color: '#fff', fontSize: 26, fontWeight: '800' },
  brandSub:      { color: '#e5e7eb', marginTop: 4, fontSize: 13 },

  card:          { flex: 1, backgroundColor: '#fff', marginTop: -24, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  cardScroll:    { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  heading:       { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subHeading:    { fontSize: 14, color: '#64748b', marginTop: 6, marginBottom: 28 },

  inputGroup:    { marginBottom: 18 },
  label:         { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input:         { height: 50, backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 16, fontSize: 14, color: '#0f172a' },
  passwordWrap:  { position: 'relative' },
  passwordInput: { height: 50, backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 16, paddingRight: 50, fontSize: 14, color: '#0f172a' },
  eyeIcon:       { position: 'absolute', right: 16, top: 15 },
  inputError:    { borderWidth: 1.5, borderColor: '#ef4444' },
  errorText:     { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4 },

  forgotWrap:    { alignItems: 'flex-end', marginBottom: 24 },
  forgotText:    { fontSize: 12, color: PRIMARY, fontWeight: '600' },

  btn:           { height: 48, backgroundColor: PRIMARY, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  btnDisabled:   { backgroundColor: '#9ca3af' },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:    { fontSize: 14, color: '#64748b' },
  footerLink:    { fontSize: 14, color: PRIMARY, fontWeight: '700' },
});
