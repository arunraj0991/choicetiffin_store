import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import WeeklyMenuModal from '@/components/WeeklyMenuModal';
import BankDetailModal from '@/components/BankDetailModal';
import LeaveRequestModal from '@/components/LeaveRequestModal';

import COLORS from '@/constants/colors';
import { useLanguage } from '@/src/i18n/context';
import { Lang } from '@/src/i18n/translations';
import { storeDeleteAccount, storeGetSettings, storeLogout } from '@/src/api/api';
import { OneSignal } from '@/src/onesignal';

const PRIMARY = COLORS.primary;

const LANGUAGES: { code: Lang; native: string; english: string }[] = [
  { code: 'en', native: 'English',  english: 'English' },
  { code: 'es', native: 'Español',  english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'ar', native: 'العربية',  english: 'Arabic (RTL)' },
];

// ── Menu data ─────────────────────────────────────────────────────────────────

interface MenuItem {
  label:  string;
  icon:   string;
  route?: string;
  color?: string;
  onPress?: () => void;
}

interface Section {
  title?: string;
  items:  MenuItem[];
}

// ── Row component ─────────────────────────────────────────────────────────────

function MenuRow({ item }: { item: MenuItem }) {
  const iconColor = item.color ?? PRIMARY;
  return (
    <TouchableOpacity
      style={s.row}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[s.iconWrap, { backgroundColor: item.color ? `${item.color}18` : '#f0ebff' }]}>
        <MaterialIcons name={item.icon as any} size={20} color={iconColor} />
      </View>
      <Text style={[s.rowLabel, item.color && { color: item.color }]}>{item.label}</Text>
      <MaterialIcons name="chevron-right" size={20} color={item.color ?? '#cbd5e1'} />
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Options() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [showLangModal,     setShowLangModal]     = useState(false);
  const [showWeeklyMenu,    setShowWeeklyMenu]    = useState(false);
  const [showBankDetail,    setShowBankDetail]    = useState(false);
  const [showLeaveRequest,  setShowLeaveRequest]  = useState(false);
  const [deletePassword,    setDeletePassword]    = useState('');
  const [deleting,          setDeleting]          = useState(false);
  const [loggingOut,        setLoggingOut]        = useState(false);
  const [openingSupport,    setOpeningSupport]    = useState(false);

  const doLogout = () => {
    Alert.alert(t('logoutTitle'), t('logoutConfirm'), [
      { text: t('cancelBtn'), style: 'cancel' },
      {
        text: t('logout'), style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await storeLogout(); } catch {}
          try { OneSignal?.logout(); } catch {}
          await AsyncStorage.multiRemove(['store_token', 'store_id', 'store_name', 'store_email', 'store_phone', 'store_approved']);
          router.replace('/login');
        },
      },
    ]);
  };

  const doDeleteAccount = () => {
    setDeletePassword('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletePassword.trim()) {
      Alert.alert(t('required'), t('enterPasswordRequired'));
      return;
    }
    setDeleting(true);
    try {
      const res = await storeDeleteAccount(deletePassword.trim());
      if (res.msg === 'error') {
        Alert.alert(t('error'), res.error || t('couldNotDelete'));
        return;
      }
      await AsyncStorage.multiRemove(['store_token', 'store_id', 'store_name', 'store_email', 'store_phone', 'store_approved']);
      setShowDeleteModal(false);
      router.replace('/login');
    } catch {
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setDeleting(false);
    }
  };

  const handleLanguageChange = async (lang: Lang) => {
    const wasAr = language === 'ar';
    const isAr  = lang === 'ar';
    await setLanguage(lang);
    setShowLangModal(false);
    if (wasAr !== isAr) {
      Alert.alert(t('languageRestart'), t('restartMessage'));
    }
  };

  const openSupportContact = async () => {
    if (openingSupport) return;
    setOpeningSupport(true);
    try {
      const res = await storeGetSettings();
      const raw =
        res?.data?.whatsapp
        ?? res?.whatsapp
        ?? res?.data?.whatsapp_number
        ?? res?.data?.whatsapp_no
        ?? '';
      const phone = String(raw).replace(/[^\d]/g, '');

      if (!phone) {
        Alert.alert(t('error'), t('supportContactUnavailable'));
        return;
      }

      const appUrl = `whatsapp://send?phone=${phone}`;
      const webUrl = `https://wa.me/${phone}`;
      const canOpenApp = await Linking.canOpenURL(appUrl);

      await Linking.openURL(canOpenApp ? appUrl : webUrl);
    } catch {
      Alert.alert(t('error'), t('supportContactFailed'));
    } finally {
      setOpeningSupport(false);
    }
  };

  const sections: Section[] = [
    {
      items: [
        { label: t('businessSettings'), icon: 'settings', route: '/business-settings' },
        { label: t('weeklyMenu'), icon: 'restaurant-menu', onPress: () => setShowWeeklyMenu(true) },
        { label: t('trainingVideos'), icon: 'ondemand-video', route: '/training-videos' },
        { label: t('leaveRequest'), icon: 'event-busy', onPress: () => setShowLeaveRequest(true) },
        { label: t('supportTicket'), icon: 'support-agent', route: '/complaints' },
        {
          label: openingSupport ? t('openingWhatsApp') : t('supportContact'),
          icon: 'chat',
          onPress: openSupportContact,
        },
        { label: t('customerReviews'), icon: 'rate-review', route: '/customer-reviews' },
        { label: t('penalty'), icon: 'gavel', route: '/penalty' },
        { label: t('incentive'), icon: 'emoji-events', route: '/incentive' },
      ],
    },
 
    {
      title: t('sectionPayout'),
      items: [
        { label: t('manageEarnings'), icon: 'account-balance-wallet', route: '/earnings' },
        { label: t('earning'), icon: 'payments', route: '/earning' },
        { label: t('bankDetail'), icon: 'account-balance', onPress: () => setShowBankDetail(true) },
      ],
    },
    // {
    //   title: t('sectionReporting'),
    //   items: [
    //     { label: t('salesRevenue'), icon: 'bar-chart',  route: '/report-sales' },
    //     { label: t('ordersReport'), icon: 'receipt',    route: '/report-orders' },
    //     { label: t('products'),     icon: 'restaurant', route: '/report-products' },
    //     // { label: t('deliveryStaff'),icon: 'people',     route: '/report-riders' },
    //   ],
    // },
    {
      items: [
        { label: t('changeLanguage'), icon: 'language', onPress: () => setShowLangModal(true) },
        { label: t('deleteAccount'),  icon: 'delete-forever', color: '#ef4444', onPress: doDeleteAccount },
        { label: t('logout'),         icon: 'logout',         color: '#ef4444', onPress: doLogout },
      ],
    },
  ];

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('options')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {sections.map((sec, si) => (
          <View key={si} style={s.section}>
            {sec.title && <Text style={s.sectionTitle}>{sec.title}</Text>}
            <View style={s.card}>
              {sec.items.map((item, ii) => {
                const itemWithNav = item.onPress
                  ? item
                  : { ...item, onPress: () => router.push(item.route as any) };
                return (
                  <View key={ii}>
                    <MenuRow item={itemWithNav} />
                    {ii < sec.items.length - 1 && <View style={s.divider} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Weekly Menu Modal ── */}
      <WeeklyMenuModal visible={showWeeklyMenu} onClose={() => setShowWeeklyMenu(false)} />

      {/* ── Bank Detail Modal ── */}
      <BankDetailModal visible={showBankDetail} onClose={() => setShowBankDetail(false)} />

      {/* ── Leave Request Modal ── */}
      <LeaveRequestModal visible={showLeaveRequest} onClose={() => setShowLeaveRequest(false)} />

      {/* ── Language Modal ── */}
      <Modal visible={showLangModal} transparent animationType="slide" onRequestClose={() => setShowLangModal(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setShowLangModal(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{t('selectLanguage')}</Text>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[s.langRow, language === lang.code && s.langRowActive]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <View style={s.langTexts}>
                <Text style={[s.langNative, language === lang.code && { color: PRIMARY }]}>{lang.native}</Text>
                <Text style={s.langEnglish}>{lang.english}</Text>
              </View>
              {language === lang.code
                ? <MaterialIcons name="check-circle" size={22} color={PRIMARY} />
                : <View style={s.langRadio} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.sheetCancel} onPress={() => setShowLangModal(false)}>
            <Text style={s.sheetCancelText}>{t('cancelBtn')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={s.overlay}>
          <View style={s.dialog}>
            <View style={s.dialogIconWrap}>
              <MaterialIcons name="delete-forever" size={32} color="#dc2626" />
            </View>
            <Text style={s.dialogTitle}>{t('deleteAccountTitle')}</Text>

            <Text style={s.dialogWarning}>{t('deleteWarning')}</Text>
            <Text style={s.dialogBody}>{t('deleteBody')}</Text>
            <View style={s.bulletList}>
              <Text style={s.bullet}>{t('bullet1')}</Text>
              <Text style={s.bullet}>{t('bullet2')}</Text>
              <Text style={s.bullet}>{t('bullet3')}</Text>
              <Text style={s.bullet}>{t('bullet4')}</Text>
              <Text style={s.bullet}>{t('bullet5')}</Text>
              <Text style={s.bullet}>{t('bullet6')}</Text>
            </View>

            <Text style={s.dialogPassLabel}>{t('enterPasswordConfirm')}</Text>
            <TextInput
              style={s.dialogInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder={t('yourAccountPassword')}
              placeholderTextColor="#bbb"
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={s.dialogBtns}>
              <TouchableOpacity
                style={s.dialogCancel}
                onPress={() => { setShowDeleteModal(false); setDeletePassword(''); }}
                disabled={deleting}
              >
                <Text style={s.dialogCancelText}>{t('cancelBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dialogDelete, deleting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.dialogDeleteText}>{t('deleteForever')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.secondary },

  header:      { backgroundColor: PRIMARY, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { padding: 2 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },

  scroll:  { padding: 16, paddingBottom: 40 },

  section:      { marginBottom: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4, marginTop: 10 },

  card:    { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },

  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 64 },

  // Language sheet
  sheetOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:           { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12 },
  sheetHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:      { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  langRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  langRowActive:   { backgroundColor: '#f0ebff', borderRadius: 12, paddingHorizontal: 8, marginHorizontal: -8 },
  langTexts:       { flex: 1 },
  langNative:      { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  langEnglish:     { fontSize: 12, color: '#64748b', marginTop: 2 },
  langRadio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cbd5e1' },
  sheetCancel:     { marginTop: 16, height: 46, backgroundColor: '#f1f5f9', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  sheetCancelText: { fontSize: 15, fontWeight: '700', color: '#64748b' },

  // Delete modal
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog:          { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%' },
  dialogIconWrap:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 },
  dialogTitle:     { fontSize: 20, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  dialogWarning:   { fontSize: 13, fontWeight: '700', color: '#dc2626', textAlign: 'center', marginBottom: 10 },
  dialogBody:      { fontSize: 13, color: '#374151', marginBottom: 8 },
  bulletList:      { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16 },
  bullet:          { fontSize: 13, color: '#7f1d1d', marginBottom: 4, lineHeight: 20 },
  dialogPassLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  dialogInput:     { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a', marginBottom: 16 },
  dialogBtns:      { flexDirection: 'row', gap: 10 },
  dialogCancel:    { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  dialogCancelText:{ fontWeight: '700', color: '#374151', fontSize: 14 },
  dialogDelete:    { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center' },
  dialogDeleteText:{ fontWeight: '700', color: '#fff', fontSize: 14 },
});
