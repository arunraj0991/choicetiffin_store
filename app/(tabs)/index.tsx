import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import ChecklistModal, { isChecklistComplete } from '@/components/ChecklistModal';
import DeliveryCard from '@/components/DeliveryCard';
import PrintDeliveryModal from '@/components/PrintDeliveryModal';
import MealTypeFilter, { MealFilter, matchesMealFilter, mealFilterCounts, isChecklistTimeEnabled, defaultMealFilterByTime } from '@/components/MealTypeFilter';

import COLORS from '@/constants/colors';
import { useAppRefresh } from '@/src/appRefresh';
import { useLanguage } from '@/src/i18n/context';
import {
  storeHome,
  storeMarkDelivered,
  storeProfile,
  getTodayPrintUrl,
  storeStartCooking,
  storeTodayDelivery,
  storeUpcomingDelivery,
} from '@/src/api/api';

const PRIMARY    = COLORS.primary;

type CookingSlot = 'Lunch' | 'Dinner';

/** Cooking popup windows: 07:00–11:00 (Lunch) and 16:00–19:00 (Dinner). */
function getCookingSlot(now = new Date()): CookingSlot | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 7 * 60 && minutes < 11 * 60) return 'Lunch';
  if (minutes >= 16 * 60 && minutes < 19 * 60) return 'Dinner';
  return null;
}

function cookingWindowLabel(now = new Date()) {
  const slot = getCookingSlot(now);
  if (slot === 'Lunch') return '7:00 AM – 11:00 AM (Lunch)';
  if (slot === 'Dinner') return '4:00 PM – 7:00 PM (Dinner)';
  return '7:00 AM – 11:00 AM / 4:00 PM – 7:00 PM';
}

function itemMealTypeLabel(item: {
  meal_type?: string | null;
  mealType?: string | null;
}) {
  return String(item.meal_type ?? item.mealType ?? '')
    .trim()
    .toLowerCase();
}

function cookingDataStatus(item: { cooking_data?: any }) {
  const raw = item.cooking_data;
  if (raw == null) return '';
  if (typeof raw === 'string') {
    try {
      return String(JSON.parse(raw)?.status ?? '').toLowerCase();
    } catch {
      return raw.toLowerCase();
    }
  }
  return String(raw?.status ?? '').toLowerCase();
}

function matchesCookingSlot(item: {
  meal_type?: string | null;
  mealType?: string | null;
}, slot: CookingSlot) {
  const meal = itemMealTypeLabel(item);
  const want = slot.toLowerCase();
  return meal === want || meal.includes(want);
}

function getEligibleCookingDeliveries<T extends {
  id: number | string;
  meal_type?: string | null;
  mealType?: string | null;
  cooking_data?: any;
}>(list: T[], slot: CookingSlot | null) {
  if (!slot) return [];
  return list.filter(item =>
    matchesCookingSlot(item, slot) && cookingDataStatus(item) === 'not_started',
  );
}

const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const deliveryTotal = (delivery: any): number => {
  const total = Number(delivery?.total);
  if (!Number.isNaN(total) && delivery?.total != null) return total;
  return (delivery?.data ?? []).length;
};

const fmtHomeDate = (d?: string | null) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  });
};

interface Overview { active: number; meal: number; delivery: number; }
interface OrderStat { active: number; paused: number; completed: number; cancelled: number; total: number; }
interface LatestItem {
  id: number;
  uid: string;
  name: string;
  phone: string;
  address: string;
  house_no: string;
  status: string;
  storeTotal: number;
  zone_name: string | null;
  rider_name?: string | null;
  meal_name?: string | null;
  mealType?: string | null;
  delivery_date?: string | null;
  created_at?: string | null;
  status_date?: string | null;
  meal_description?: string | null;
  des?: string | null;
  desc?: string | null;
  description?: string | null;
}
interface DeliveryItem {
  id: number;
  order_id: number;
  user_name: string;
  user_phone: string;
  address: string;
  house_no: string;
  meal_name: string;
  mealType: string;
  delSlot?: string | null;
  del_slot?: string | null;
  meal_type?: string | null;
  cate_id?: number | string | null;
  cate_name?: string | null;
  delivery_status: string;
  delivery_date?: string | null;
  rider_name: string | null;
  zone_name: string | null;
  meal_description?: string | null;
  des?: string | null;
  desc?: string | null;
  description?: string | null;
  checklist?: any[] | null;
  modify_items?: any[] | string | Record<string, any> | null;
  delivery_instruction?: any;
  delivery_instruction_image?: string | null;
  spInst?: any[] | string | null;
  is_same_customer?: boolean | number | string | null;
  same_customer_badge?: {
    is_same_customer?: boolean | number | string | null;
    badge_text?: string | null;
    total_orders?: number | null;
    phone?: string | null;
  } | null;
  cooking_data?: {
    status?: string | null;
    slot?: string | null;
    start_time?: string | null;
    notes?: string | null;
  } | string | null;
}
interface Cate { id: number; name: string; }

interface HomeData {
  overview:       Overview;
  order:          OrderStat;
  latest:         { data: LatestItem[] };
  cates:          Cate[];
  currency:       string;
  product_img_url?: string;
}

export default function HomeScreen() {
  const headerPad = useSafeHeaderPad();
  const router      = useRouter();
  const { t }       = useLanguage();

  const [storeName, setStoreName] = useState('');
  const [data,      setData]      = useState<HomeData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [profileGateMsg, setProfileGateMsg] = useState('');
  const [todayDeliveryCount, setTodayDeliveryCount] = useState(0);
  const [upcomingDeliveryCount, setUpcomingDeliveryCount] = useState(0);
  const [todayDeliveryList, setTodayDeliveryList] = useState<DeliveryItem[]>([]);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [checklistItem, setChecklistItem] = useState<DeliveryItem | null>(null);
  const [mealFilter, setMealFilter] = useState<MealFilter>(defaultMealFilterByTime);
  const [showCookingModal, setShowCookingModal] = useState(false);
  const [startingCook, setStartingCook] = useState(false);
  const [clockTick, setClockTick] = useState(0);

  const cookingSlot = useMemo(() => getCookingSlot(), [clockTick]);
  const eligibleCooking = useMemo(
    () => getEligibleCookingDeliveries(todayDeliveryList, cookingSlot),
    [todayDeliveryList, cookingSlot],
  );
  const canStartCooking = cookingSlot != null && eligibleCooking.length > 0;

  useEffect(() => {
    // Popup only when time window + matching meal_type + cooking_data not_started
    setShowCookingModal(canStartCooking);
  }, [canStartCooking]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const checkRegFssai = useCallback(async () => {
    try {
      const res = await storeProfile();
      const d = res.data ?? {};
      const reg = String(d.reg_no ?? '').trim();
      const fsi = String(d.fsi_no ?? '').trim();

      if (reg && fsi) {
        setShowRegModal(false);
        return;
      }

      setProfileGateMsg(
        'Registration number and FSSAI / licence number are required. Please fill them in Business Settings → Other Info to continue using the app.',
      );
      setShowRegModal(true);
    } catch {
      // Don't block dashboard if profile check fails
    }
  }, []);

  const fetchTodayDeliveries = useCallback(async () => {
    const tomorrow = addDays(new Date(), 1);
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        storeTodayDelivery(),
        storeUpcomingDelivery(tomorrow, tomorrow),
      ]);
      const delivery = todayRes?.data?.delivery ?? todayRes?.delivery ?? {};
      const rows: DeliveryItem[] = Array.isArray(delivery?.data)
        ? delivery.data
        : Array.isArray(delivery)
          ? delivery
          : [];
      setTodayDeliveryList(rows);
      setTodayDeliveryCount(deliveryTotal(delivery));
      setUpcomingDeliveryCount(deliveryTotal(upcomingRes?.data?.delivery ?? upcomingRes?.delivery));
    } catch {
      // Keep previous list/counts on failure
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('store_name').then(n => setStoreName(n || 'Store'));
    fetchHome();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkRegFssai();
      fetchTodayDeliveries();
      setClockTick(n => n + 1);
    }, [checkRegFssai, fetchTodayDeliveries]),
  );

  const fetchHome = useCallback(async () => {
    setError(false);
    try {
      const [res] = await Promise.all([storeHome(), fetchTodayDeliveries()]);
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchTodayDeliveries]);

  useAppRefresh(
    useCallback(() => {
      fetchHome();
      checkRegFssai();
    }, [fetchHome, checkRegFssai]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHome();
    checkRegFssai();
  }, [checkRegFssai, fetchHome]);

  const openPrintInBrowser = useCallback(async () => {
    try {
      const [id, token] = await Promise.all([
        AsyncStorage.getItem('store_id'),
        AsyncStorage.getItem('store_token'),
      ]);
      if (!id) {
        Alert.alert(t('error'), t('printFailed'));
        return;
      }
      const url = getTodayPrintUrl(id, token);
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(t('error'), t('printFailed'));
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('error'), t('printFailed'));
    }
  }, [t]);

  const markAsPickup = useCallback((item: DeliveryItem) => {
    if (!isChecklistComplete(item)) {
      Alert.alert(t('markAsPickup'), t('checklistRequired'));
      return;
    }
    Alert.alert(t('markAsPickup'), t('markPickupConfirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yesMarkPickup'),
        onPress: async () => {
          setMarkingId(item.id);
          try {
            const res = await storeMarkDelivered(item.id);
            await fetchTodayDeliveries();
            if (res.msg !== 'done' && res.status !== true && res.status !== 'success') {
              Alert.alert(t('error'), res.error || res.message || t('failedMarkPickup'));
            }
          } catch {
            Alert.alert(t('error'), t('failedMarkPickup'));
          } finally {
            setMarkingId(null);
          }
        },
      },
    ]);
  }, [fetchTodayDeliveries, t]);

  const closeApp = () => {
    BackHandler.exitApp();
  };

  const goFillOtherInfo = () => {
    setShowRegModal(false);
    router.push({ pathname: '/business-settings', params: { tab: 'other' } } as any);
  };

  const startCooking = async () => {
    const slot = getCookingSlot();
    const eligible = getEligibleCookingDeliveries(todayDeliveryList, slot);
    if (!slot || eligible.length === 0) {
      Alert.alert(
        t('startCooking'),
        !slot ? t('cookingWindowClosed') : t('noCookingEligible'),
      );
      setShowCookingModal(false);
      return;
    }
    setStartingCook(true);
    try {
      const res = await storeStartCooking({
        delivery_ids: eligible.map(item => item.id),
        slot,
      });
      if (res?.msg === 'error' || res?.status === false) {
        Alert.alert(t('error'), res.error || res.message || t('failedStartCooking'));
      } else {
        Alert.alert(t('successTitle'), t('cookingStarted'));
        await fetchTodayDeliveries();
        setShowCookingModal(false);
      }
    } catch {
      Alert.alert(t('error'), t('failedStartCooking'));
    } finally {
      setStartingCook(false);
    }
  };

  const initials = storeName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="wifi-off" size={48} color="#cbd5e1" />
        <Text style={styles.errorText}>{t('failedLoadDashboard')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchHome(); }}>
          <Text style={styles.retryText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { order, cates } = data;
  const filteredToday = todayDeliveryList.filter(item => matchesMealFilter(item, mealFilter, cates));
  const todayMealCounts = mealFilterCounts(todayDeliveryList, cates);
  // Prefer API total for "All" so count matches server total when list is paged/partial
  const mealCounts = {
    ...todayMealCounts,
    all: todayDeliveryCount > 0 ? todayDeliveryCount : todayMealCounts.all,
  };
  const todayCardCount = mealFilter === 'all' ? mealCounts.all : mealCounts[mealFilter];
  const hasTodayDelivery = filteredToday.length > 0;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Registration / FSSAI required */}
      <Modal
        visible={showRegModal}
        transparent
        animationType="fade"
        onRequestClose={closeApp}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="assignment-late" size={28} color={PRIMARY} />
            </View>
            <Text style={styles.modalTitle}>Complete Business Info</Text>
            <Text style={styles.modalMsg}>
              {profileGateMsg ||
                'Please complete your registration number and FSSAI / licence number in Business Settings → Other Info.'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={closeApp} activeOpacity={0.85}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOkBtn} onPress={goFillOtherInfo} activeOpacity={0.85}>
                <Text style={styles.modalOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Cooking — only during 7–11 AM and 4–7 PM */}
      <Modal
        visible={showCookingModal && !showRegModal && canStartCooking}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#fff7ed' }]}>
              <MaterialIcons name="restaurant" size={28} color="#ea580c" />
            </View>
            <Text style={styles.modalTitle}>{t('startCooking')}</Text>
            <Text style={styles.modalMsg}>
              {t('startCookingMsg')}{'\n'}
              <Text style={{ fontWeight: '700', color: '#0f172a' }}>{cookingWindowLabel()}</Text>
              {cookingSlot ? `\n${t('cookingSlot')}: ${cookingSlot}` : ''}
              {'\n'}
              {t('cookingEligibleCount').replace('{count}', String(eligibleCooking.length))}
            </Text>
            <TouchableOpacity
              style={[styles.cookBtn, startingCook && styles.cookBtnDisabled]}
              onPress={startCooking}
              disabled={startingCook}
              activeOpacity={0.85}
            >
              {startingCook
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <MaterialIcons name="local-fire-department" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.cookBtnText}>{t('startCooking')}</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{t('goodDay')}</Text>
          <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications' as any)}>
            <MaterialIcons name="notifications-none" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
      >

        {/* Order Status */}
        <SectionHeader title={t('subscriptions')} />
        <View style={styles.statusRow}>
          <StatusChip label={t('active')}    count={order.active}    color="#4A1594" bg="#f0ebff" />
          <StatusChip label={t('today')}     count={todayCardCount} color="#d97706" bg="#fef3c7" />
          <StatusChip label={t('upcoming')}  count={upcomingDeliveryCount} color="#16a34a" bg="#dcfce7" />
          <StatusChip label={t('cancelled')} count={order.cancelled} color="#dc2626" bg="#fee2e2" />
        </View>

        {/* Categories */}
        {/* {cates.length > 0 && (
          <>
            <SectionHeader title={t('mealCategories')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cateScroll}>
              {cates.map(c => (
                <View key={c.id} style={styles.cateChip}>
                  <Text style={styles.cateText}>{c.name}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )} */}

        {/* Today's Deliveries */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { flex: 1, marginBottom: 0, marginTop: 0 }]}>
            {t('todaysDeliveries')}
          </Text>
          <TouchableOpacity
            style={styles.printHeaderBtn}
            onPress={openPrintInBrowser}
            activeOpacity={0.85}
          >
            <MaterialIcons name="print" size={18} color="#fff" />
            <Text style={styles.printHeaderBtnText}>{t('print')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mealFilterWrap}>
          <MealTypeFilter
            value={mealFilter}
            onChange={setMealFilter}
            labels={{
              all: t('allMeals'),
              breakfast: t('breakfast'),
              lunch: t('lunch'),
              dinner: t('dinner'),
            }}
            counts={mealCounts}
          />
        </View>
        {hasTodayDelivery ? (
          filteredToday.map(item => {
            const status = String(item.delivery_status || '').toLowerCase();
            const showMarkPickup = status === 'scheduled' || status === 'modified';
            const checklistReady = isChecklistComplete(item);
            const checklistOpen = isChecklistTimeEnabled(item);
            return (
              <DeliveryCard
                key={item.id}
                item={item}
                instructionLabel={t('deliveryInstruction')}
                noInstructionLabel={t('noInstruction')}
                noZoneLabel={t('noZone')}
                markAsPickupLabel={t('markAsPickup')}
                checklistLabel={t('checklist')}
                sameCustomerLabel={t('sameCustomer')}
                showChecklist={showMarkPickup}
                showMarkPickup={showMarkPickup}
                checklistDisabled={!checklistOpen}
                markPickupDisabled={!checklistReady}
                marking={markingId === item.id}
                onChecklist={() => {
                  if (!isChecklistTimeEnabled(item)) {
                    const slot = String(item.meal_type ?? item.mealType ?? '').toLowerCase();
                    Alert.alert(
                      t('checklist'),
                      slot.includes('dinner') ? t('checklistOpensAfter4pm') : t('checklistOpensAfter8am'),
                    );
                    return;
                  }
                  setChecklistItem(item);
                }}
                onMarkPickup={() => markAsPickup(item)}
                onPress={() => router.push('/(tabs)/deliveries' as any)}
              />
            );
          })
        ) : (
          <View style={styles.emptyToday}>
            <MaterialIcons name="inbox" size={40} color="#cbd5e1" />
            <Text style={styles.emptyTodayText}>{t('noTodayDeliveryFound')}</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <ChecklistModal
        item={checklistItem}
        onClose={() => setChecklistItem(null)}
        onSaved={fetchTodayDeliveries}
      />
      <PrintDeliveryModal visible={false} onClose={() => {}} />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function StatusChip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: bg }]}>
      <Text style={[styles.statusCount, { color }]}>{count}</Text>
      <Text style={[styles.statusLabel, { color }]}>{label}</Text>
    </View>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'Active':    return { bg: '#f0ebff', text: '#4A1594' };
    case 'Paused':    return { bg: '#fef3c7', text: '#d97706' };
    case 'Completed': return { bg: '#dcfce7', text: '#16a34a' };
    case 'Cancelled': return { bg: '#fee2e2', text: '#dc2626' };
    default:          return { bg: '#f1f5f9', text: '#64748b' };
  }
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.secondary },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.secondary },
  errorText:     { color: '#94a3b8', fontSize: 15, marginTop: 12, marginBottom: 20 },
  retryBtn:      { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: PRIMARY, borderRadius: 12 },
  retryText:     { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  modalCard:     { width: '100%', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18 },
  modalIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  modalMsg:      { fontSize: 14, lineHeight: 21, color: '#64748b', textAlign: 'center', marginBottom: 22 },
  modalActions:  { flexDirection: 'row', gap: 10 },
  modalCloseBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCloseText:{ fontSize: 15, fontWeight: '700', color: '#475569' },
  modalOkBtn:    { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center' },
  modalOkText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  cookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  cookBtnDisabled: { backgroundColor: '#fdba74', opacity: 0.85 },
  cookBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Header
  header:        { backgroundColor: PRIMARY, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft:    { flex: 1 },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  greeting:      { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  storeName:     { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 2 },
  avatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  avatarText:    { color: '#fff', fontSize: 16, fontWeight: '800' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12, marginTop: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  printHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  printHeaderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  mealFilterWrap: {
    marginHorizontal: -16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // Status chips
  statusRow:     { flexDirection: 'row', gap: 8 },
  statusChip:    { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statusCount:   { fontSize: 18, fontWeight: '800' },
  statusLabel:   { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Categories
  cateScroll:    { gap: 8, paddingBottom: 4 },
  cateChip:      { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  cateText:      { fontSize: 13, fontWeight: '600', color: '#334155' },

  // Recent list cards (non-delivery)
  homeDelCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  homeDelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  homeDelAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0ebff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  homeDelAvatarText: { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  homeDelMeta: { flex: 1 },
  homeDelName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  homeDelPhone: { fontSize: 12, color: '#64748b', marginTop: 1 },
  homeDelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  homeDelBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  homeDelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  homeDelRowText: { fontSize: 12, color: '#64748b', flex: 1 },
  homeDelDescRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 5,
  },
  homeDelDescText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    lineHeight: 17,
  },
  homeDelDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 2,
  },
  emptyToday: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  emptyTodayText: {
    marginTop: 10,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
