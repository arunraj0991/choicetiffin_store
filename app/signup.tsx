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
import { GOOGLE_MAPS_APIKEY } from '@/constants/maps';
import GooglePlacesAddressInput from '@/components/GooglePlacesAddressInput';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useLanguage } from '@/src/i18n/context';
import { storeSignup } from '@/src/api/api';
import { OneSignal } from '@/src/onesignal';

const PRIMARY = COLORS.primary;

export default function Signup() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [regNo, setRegNo] = useState('');
  const [fsiNo, setFsiNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('fullNameRequired');
    if (!email.trim()) e.email = t('emailRequired');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('validEmail');
    if (!phone.trim()) e.phone = t('phoneRequired');
    else if (!/^\d{7,15}$/.test(phone.replace(/\s/g, ''))) e.phone = t('validPhone');
    if (!address.trim()) e.address = t('addressRequired');
    if (!regNo.trim()) e.regNo = t('registrationRequired');
    if (!fsiNo.trim()) e.fsiNo = t('fssaiRequired');
    if (!password.trim()) e.password = t('passwordRequired');
    else if (password.length < 6) e.password = t('atLeast6Chars');
    if (!agree) e.terms = t('termsRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        reg_no: regNo.trim(),
        fsi_no: fsiNo.trim(),
        password,
      };
      if (lat) payload.lat = lat;
      if (lng) payload.lng = lng;

      const data = await storeSignup(payload);

      if (data.msg === 'done') {
        OneSignal?.login(String(data.store_id));
        OneSignal?.User.addTag('user_id', String(data.store_id));
        router.push({ pathname: '/otp' as any, params: { storeId: data.store_id } });
      } else {
        Alert.alert(t('error'), data.error || t('signupFailed'));
      }
    } catch {
      Alert.alert(t('error'), t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: string) =>
    setErrors(p => ({ ...p, [field]: null }));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      <View style={[styles.topBar, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('signUpTitle')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>{t('createYourStore')}</Text>
        <Text style={styles.subHeading}>{t('joinPlatform')}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('storeFullName')}</Text>
          <TextInput
            placeholder={t('storeNamePlaceholder')}
            placeholderTextColor="#9ca3af"
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={v => { setName(v); clearError('name'); }}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('email')}</Text>
          <TextInput
            placeholder={t('storePlaceholder')}
            placeholderTextColor="#9ca3af"
            style={[styles.input, errors.email && styles.inputError]}
            value={email}
            onChangeText={v => { setEmail(v); clearError('email'); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('phoneNumber')}</Text>
          <TextInput
            placeholder="9876543210"
            placeholderTextColor="#9ca3af"
            style={[styles.input, errors.phone && styles.inputError]}
            value={phone}
            onChangeText={v => { setPhone(v); clearError('phone'); }}
            keyboardType="phone-pad"
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        <View style={[styles.inputGroup, { zIndex: 30 }]}>
          <Text style={styles.label}>{t('address')}</Text>
          <GooglePlacesAddressInput
            mapKey={GOOGLE_MAPS_APIKEY}
            value={address}
            placeholder={t('searchAddress')}
            error={!!errors.address}
            onSelect={(addr, nextLat, nextLng) => {
              setAddress(addr);
              setLat(nextLat || '');
              setLng(nextLng || '');
              clearError('address');
            }}
          />
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('registrationNumber')}</Text>
          <TextInput
            placeholder={t('registrationPlaceholder')}
            placeholderTextColor="#9ca3af"
            style={[styles.input, errors.regNo && styles.inputError]}
            value={regNo}
            onChangeText={v => { setRegNo(v); clearError('regNo'); }}
            autoCapitalize="characters"
          />
          {errors.regNo && <Text style={styles.errorText}>{errors.regNo}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('fssaiNumber')}</Text>
          <TextInput
            placeholder={t('fssaiPlaceholder')}
            placeholderTextColor="#9ca3af"
            style={[styles.input, errors.fsiNo && styles.inputError]}
            value={fsiNo}
            onChangeText={v => { setFsiNo(v); clearError('fsiNo'); }}
            autoCapitalize="characters"
          />
          {errors.fsiNo && <Text style={styles.errorText}>{errors.fsiNo}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('password')}</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              style={[styles.passwordInput, errors.password && styles.inputError]}
              value={password}
              onChangeText={v => { setPassword(v); clearError('password'); }}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPass(!showPass)}>
              <MaterialIcons name={showPass ? 'visibility' : 'visibility-off'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => { setAgree(!agree); clearError('terms'); }}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agree && styles.checkboxActive]}>
            {agree && <Text style={styles.check}>✓</Text>}
          </View>
          <Text style={styles.termsText}>{t('agreeTerms')}</Text>
        </TouchableOpacity>
        {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.btnText}>{t('signUpTitle')}</Text>}
        </TouchableOpacity>

        <Text style={styles.footer}>
          {t('alreadyHaveAccount')}
          <Text style={styles.footerLink} onPress={() => router.replace('/login' as any)}> {t('logIn')}</Text>
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.secondary },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' },

  content: { paddingHorizontal: 20, paddingTop: 8 },
  heading: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subHeading: { fontSize: 14, color: '#6b7280', marginBottom: 28 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#1f2937', marginBottom: 6 },
  input: { height: 50, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, fontSize: 15, color: '#111827', borderWidth: 1, borderColor: COLORS.border },
  passwordWrap: { position: 'relative' },
  passwordInput: { height: 50, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingRight: 50, fontSize: 15, color: '#111827', borderWidth: 1, borderColor: COLORS.border },
  eyeIcon: { position: 'absolute', right: 16, top: 15 },
  inputError: { borderColor: COLORS.danger, borderWidth: 1.5 },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4, marginLeft: 4 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#c7c7c7', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  check: { color: '#fff', fontSize: 14, fontWeight: '700' },
  termsText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 18 },

  btn: { height: 48, backgroundColor: PRIMARY, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { textAlign: 'center', marginTop: 24, fontSize: 14, color: '#6b7280' },
  footerLink: { color: PRIMARY, fontWeight: '700' },
});
