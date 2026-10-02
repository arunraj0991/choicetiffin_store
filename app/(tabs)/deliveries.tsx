import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DeliveryCard from '@/components/DeliveryCard';
import ChecklistModal, { isChecklistComplete } from '@/components/ChecklistModal';
import PrintDeliveryModal from '@/components/PrintDeliveryModal';
import DateRangeCalendarModal, { toApiDate } from '@/components/DateRangeCalendarModal';
import MealTypeFilter, { MealFilter, matchesMealFilter, mealFilterCounts, isChecklistTimeEnabled, defaultMealFilterByTime } from '@/components/MealTypeFilter';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { useAppRefresh } from '@/src/appRefresh';
import { useLanguage } from '@/src/i18n/context';
import {
  storeHistoryDelivery,
  storeMarkDelivered,
  storeTodayDelivery,
  storeUpcomingDelivery,
} from '@/src/api/api';

const PRIMARY = COLORS.primary;

function formatDateLabel(d: Date) {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

function formatRangeLabel(start: Date, end: Date) {
  return `${formatDateLabel(start)} – ${formatDateLabel(end)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Cate     { id: number; name: string; d_time?: string; }
interface Delivery {
  id:               number;
  order_id:         number;
  delivery_date:    string;
  delivery_status:  'scheduled' | 'delivered' | 'skipped' | 'donate' | string;
  user_name:        string;
  user_phone:       string;
  meal_name:        string;
  mealType:         string;
  delSlot?:         string | null;
  del_slot?:        string | null;
  meal_type?:       string | null;
  cate_id?:         number | string | null;
  cate_name?:       string | null;
  house_no:         string;
  address:          string;
  address_type:     string;
  zone_name:        string | null;
  rider_name:       string | null;
  rider_id:         number | null;
  des?:             string | null;
  desc?:            string | null;
  description?:     string | null;
  meal_description?: string | null;
  checklist?:       any[] | null;
  modify_items?:    any[] | string | Record<string, any> | null;
  delivery_instruction?: any;
  delivery_instruction_image?: string | null;
  spInst?:          any[] | string | null;
  is_same_customer?: boolean | number | string | null;
  same_customer_badge?: {
    is_same_customer?: boolean | number | string | null;
    badge_text?: string | null;
    total_orders?: number | null;
    phone?: string | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const defaultUpcomingDate = () => addDays(new Date(), 1);
const defaultHistoryDate = () => addDays(startOfToday(), -1);
const defaultUpcomingFrom = () => defaultUpcomingDate();
const defaultUpcomingTo = () => addDays(defaultUpcomingDate(), 6);
const defaultHistoryFrom = () => addDays(startOfToday(), -7);
const defaultHistoryTo = () => defaultHistoryDate();

type DeliveryTab = 'today' | 'upcoming' | 'history';

const TAB_META: { key: DeliveryTab; icon: React.ComponentProps<typeof MaterialIcons>['name']; labelKey: 'today' | 'upcoming' | 'history' }[] = [
  { key: 'today',    icon: 'today',      labelKey: 'today' },
  { key: 'upcoming', icon: 'date-range', labelKey: 'upcoming' },
  { key: 'history',  icon: 'history',    labelKey: 'history' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function Deliveries() {
  const headerPad = useSafeHeaderPad();
  const router  = useRouter();
  const { t }   = useLanguage();

  // Tab
  const [activeTab, setActiveTab] = useState<DeliveryTab>('today');

  // Shared data
  const [cates,   setCates]   = useState<Cate[]>([]);
  const [selCate, setSelCate] = useState<Cate | null>(null);

  // Today
  const [todayList,    setTodayList]    = useState<Delivery[]>([]);
  const [todayLoad,    setTodayLoad]    = useState(true);
  const [todayHasMore, setTodayHasMore] = useState(false);
  const [todayPage,    setTodayPage]    = useState(1);

  // Upcoming
  const [upcomList,    setUpcomList]    = useState<Delivery[]>([]);
  const [upcomLoad,    setUpcomLoad]    = useState(false);
  const [upcomFetched, setUpcomFetched] = useState(false);
  const [upcomHasMore, setUpcomHasMore] = useState(false);
  const [upcomPage,    setUpcomPage]    = useState(1);
  const [upcomingFrom, setUpcomingFrom] = useState(defaultUpcomingFrom);
  const [upcomingTo,   setUpcomingTo]   = useState(defaultUpcomingTo);
  const [showUpcomDatePicker, setShowUpcomDatePicker] = useState(false);

  // History
  const [histList,    setHistList]    = useState<Delivery[]>([]);
  const [histLoad,    setHistLoad]    = useState(false);
  const [histFetched, setHistFetched] = useState(false);
  const [histHasMore, setHistHasMore] = useState(false);
  const [histPage,    setHistPage]    = useState(1);
  const [historyFrom, setHistoryFrom] = useState(defaultHistoryFrom);
  const [historyTo,   setHistoryTo]   = useState(defaultHistoryTo);
  const [showHistDatePicker, setShowHistDatePicker] = useState(false);

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // Category picker
  const [showCatePicker, setShowCatePicker] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [checklistItem, setChecklistItem] = useState<Delivery | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [mealFilter, setMealFilter] = useState<MealFilter>(defaultMealFilterByTime);
  const [, setClockTick] = useState(0);
  const upcomReqId = useRef(0);
  const histReqId = useRef(0);

  // ── Fetch today ────────────────────────────────────────────────────────────

  const fetchToday = useCallback(async (page = 1, reset = false, cate?: Cate | null) => {
    if (page === 1) setTodayLoad(true);
    const cateId = (cate !== undefined ? cate : selCate)?.id;
    try {
      const res  = await storeTodayDelivery(cateId);
      const d    = res.data;
      const rows: Delivery[] = d.delivery?.data ?? [];
      if (page === 1) {
        setCates(d.cates ?? []);
      }
      setTodayList(reset || page === 1 ? rows : prev => [...prev, ...rows]);
      setTodayHasMore((d.delivery?.current_page ?? 1) < (d.delivery?.last_page ?? 1));
      setTodayPage(page);
    } catch {
      if (page === 1) setTodayList([]);
    } finally {
      setTodayLoad(false);
      setRefreshing(false);
    }
  }, [selCate]);

  // ── Fetch upcoming ─────────────────────────────────────────────────────────

  const fetchUpcoming = useCallback(async (
    page = 1,
    cate?: Cate | null,
    range?: { from: Date; to: Date },
  ) => {
    const reqId = page === 1 ? ++upcomReqId.current : upcomReqId.current;
    if (page === 1) {
      setUpcomLoad(true);
      setUpcomList([]);
      setUpcomHasMore(false);
      setUpcomPage(1);
    }
    const cateId = (cate !== undefined ? cate : selCate)?.id;
    const from = toApiDate(range?.from ?? upcomingFrom);
    const to = toApiDate(range?.to ?? upcomingTo);
    try {
      const res  = await storeUpcomingDelivery(from, to, cateId);
      if (reqId !== upcomReqId.current) return;
      const d    = res.data;
      const rows: Delivery[] = d.delivery?.data ?? [];
      if (page === 1) {
        setCates(d.cates ?? []);
      }
      setUpcomList(page === 1 ? rows : prev => [...prev, ...rows]);
      setUpcomHasMore((d.delivery?.current_page ?? 1) < (d.delivery?.last_page ?? 1));
      setUpcomPage(page);
      setUpcomFetched(true);
    } catch {
      if (reqId !== upcomReqId.current) return;
      if (page === 1) setUpcomList([]);
      setUpcomHasMore(false);
    } finally {
      if (reqId === upcomReqId.current) {
        setUpcomLoad(false);
        setRefreshing(false);
      }
    }
  }, [selCate, upcomingFrom, upcomingTo]);

  // ── Fetch history ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async (
    page = 1,
    cate?: Cate | null,
    range?: { from: Date; to: Date },
  ) => {
    const reqId = page === 1 ? ++histReqId.current : histReqId.current;
    if (page === 1) {
      setHistLoad(true);
      setHistList([]);
      setHistHasMore(false);
      setHistPage(1);
    }
    const cateId = (cate !== undefined ? cate : selCate)?.id;
    const from = toApiDate(range?.from ?? historyFrom);
    const to = toApiDate(range?.to ?? historyTo);
    try {
      const res  = await storeHistoryDelivery(from, to, cateId);
      if (reqId !== histReqId.current) return;
      const d    = res.data;
      const rows: Delivery[] = d.delivery?.data ?? [];
      if (page === 1) {
        setCates(d.cates ?? []);
      }
      setHistList(page === 1 ? rows : prev => [...prev, ...rows]);
      setHistHasMore((d.delivery?.current_page ?? 1) < (d.delivery?.last_page ?? 1));
      setHistPage(page);
      setHistFetched(true);
    } catch {
      if (reqId !== histReqId.current) return;
      if (page === 1) setHistList([]);
      setHistHasMore(false);
    } finally {
      if (reqId === histReqId.current) {
        setHistLoad(false);
        setRefreshing(false);
      }
    }
  }, [selCate, historyFrom, historyTo]);

  useEffect(() => { fetchToday(1, true); }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockTick(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'upcoming') fetchUpcoming(1);
    if (activeTab === 'history') fetchHistory(1);
  }, [activeTab]);

  useAppRefresh(
    useCallback(() => {
      fetchToday(1, true);
      if (activeTab === 'upcoming' || upcomFetched) fetchUpcoming(1);
      if (activeTab === 'history' || histFetched) fetchHistory(1);
    }, [fetchToday, fetchUpcoming, fetchHistory, activeTab, upcomFetched, histFetched]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'today') fetchToday(1, true);
    else if (activeTab === 'upcoming') fetchUpcoming(1);
    else fetchHistory(1);
  }, [activeTab, fetchToday, fetchUpcoming, fetchHistory]);

  // ── Category chip press ────────────────────────────────────────────────────

  const selectCate = (cate: Cate | null) => {
    setSelCate(cate);
    if (activeTab === 'today') fetchToday(1, true, cate);
    else if (activeTab === 'upcoming') fetchUpcoming(1, cate);
    else fetchHistory(1, cate);
  };

  // ── Mark as delivered ──────────────────────────────────────────────────────

  const markDelivered = (del: Delivery) => {
    if (!isChecklistComplete(del)) {
      Alert.alert(t('markAsPickup'), t('checklistRequired'));
      return;
    }
    Alert.alert(t('markAsPickup'), t('markPickupConfirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yesMarkPickup'),
        onPress: async () => {
          setMarkingId(del.id);
          try {
            const res = await storeMarkDelivered(del.id);
            fetchToday(1, true);
            if (upcomFetched) fetchUpcoming(1);
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
  };

  const checklistTimeItem = (item: Delivery) =>
    mealFilter === 'lunch' || mealFilter === 'dinner'
      ? { ...item, meal_type: mealFilter, mealType: mealFilter }
      : item;

  const openChecklist = (item: Delivery) => {
    if (!isChecklistTimeEnabled(checklistTimeItem(item))) {
      const slot = mealFilter === 'dinner' || mealFilter === 'lunch'
        ? mealFilter
        : String(item.meal_type ?? item.mealType ?? '').toLowerCase();
      Alert.alert(
        t('checklist'),
        slot.includes('dinner') ? t('checklistOpensAfter4pm') : t('checklistOpensAfter8am'),
      );
      return;
    }
    setChecklistItem(item);
  };

  // ── Render card ────────────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: Delivery }) => {
    const status = String(item.delivery_status || '').toLowerCase();
    const showMarkPickup = activeTab === 'today' && (status === 'scheduled' || status === 'modified');
    const checklistReady = isChecklistComplete(item);
    const checklistOpen = activeTab !== 'today' || isChecklistTimeEnabled(checklistTimeItem(item));

    return (
      <DeliveryCard
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
        onChecklist={() => openChecklist(item)}
        onMarkPickup={() => markDelivered(item)}
      />
    );
  };

  // ── Meal type filter ───────────────────────────────────────────────────────

  const mealFilterLabels = {
    all: t('allMeals'),
    breakfast: t('breakfast'),
    lunch: t('lunch'),
    dinner: t('dinner'),
  };

  const filteredToday = todayList.filter(item => matchesMealFilter(item, mealFilter, cates));
  const filteredUpcoming = upcomList.filter(item => matchesMealFilter(item, mealFilter, cates));
  const filteredHistory = histList.filter(item => matchesMealFilter(item, mealFilter, cates));
  const mealCounts = mealFilterCounts(
    activeTab === 'today' ? todayList : activeTab === 'upcoming' ? upcomList : histList,
    cates,
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('deliveries')}</Text>
        {activeTab === 'today' ? (
          <TouchableOpacity style={styles.printHeaderBtn} onPress={() => setShowPrint(true)} activeOpacity={0.85}>
            <MaterialIcons name="print" size={16} color="#fff" />
            <Text style={styles.printHeaderBtnText}>{t('print')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {/* Main Tabs */}
      <View style={styles.tabBar}>
        {TAB_META.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <MaterialIcons
                name={tab.icon}
                size={15}
                color={active ? PRIMARY : '#9ca3af'}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── TODAY TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'today' && (
        <>
          <MealTypeFilter value={mealFilter} onChange={setMealFilter} labels={mealFilterLabels} counts={mealCounts} />
          {todayLoad && todayList.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              data={filteredToday}
              keyExtractor={i => String(i.id)}
              renderItem={renderCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
              }
              onEndReached={() => { if (todayHasMore) fetchToday(todayPage + 1); }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                todayHasMore ? <ActivityIndicator color={PRIMARY} style={{ marginVertical: 12 }} /> : null
              }
              ListEmptyComponent={<EmptyState label={t('noDeliveriesToday')} />}
            />
          )}
        </>
      )}

      {/* ── UPCOMING TAB ──────────────────────────────────────────────── */}
      {activeTab === 'upcoming' && (
        <>
          <TouchableOpacity
            style={styles.rangeBar}
            onPress={() => setShowUpcomDatePicker(true)}
            activeOpacity={0.85}
          >
            <View style={styles.rangeIconWrap}>
              <MaterialIcons name="event" size={18} color={PRIMARY} />
            </View>
            <View style={styles.rangeTexts}>
              <Text style={styles.rangeTitle}>{t('selectDateRange')}</Text>
              <Text style={styles.rangeValue}>{formatRangeLabel(upcomingFrom, upcomingTo)}</Text>
            </View>
            <MaterialIcons name="keyboard-arrow-down" size={22} color={PRIMARY} />
          </TouchableOpacity>
          <MealTypeFilter value={mealFilter} onChange={setMealFilter} labels={mealFilterLabels} counts={mealCounts} />
          {upcomLoad ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              key={`upcom-${toApiDate(upcomingFrom)}-${toApiDate(upcomingTo)}`}
              data={filteredUpcoming}
              keyExtractor={i => String(i.id)}
              renderItem={renderCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
              }
              onEndReached={() => { if (!upcomLoad && upcomHasMore) fetchUpcoming(upcomPage + 1); }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                upcomHasMore ? <ActivityIndicator color={PRIMARY} style={{ marginVertical: 12 }} /> : null
              }
              ListEmptyComponent={<EmptyState label={t('noDeliveriesRange')} />}
            />
          )}
        </>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <>
          <TouchableOpacity
            style={styles.rangeBar}
            onPress={() => setShowHistDatePicker(true)}
            activeOpacity={0.85}
          >
            <View style={styles.rangeIconWrap}>
              <MaterialIcons name="history" size={18} color={PRIMARY} />
            </View>
            <View style={styles.rangeTexts}>
              <Text style={styles.rangeTitle}>{t('selectDateRange')}</Text>
              <Text style={styles.rangeValue}>{formatRangeLabel(historyFrom, historyTo)}</Text>
            </View>
            <MaterialIcons name="keyboard-arrow-down" size={22} color={PRIMARY} />
          </TouchableOpacity>
          <MealTypeFilter value={mealFilter} onChange={setMealFilter} labels={mealFilterLabels} counts={mealCounts} />
          {histLoad ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              key={`hist-${toApiDate(historyFrom)}-${toApiDate(historyTo)}`}
              data={filteredHistory}
              keyExtractor={i => String(i.id)}
              renderItem={renderCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
              }
              onEndReached={() => { if (!histLoad && histHasMore) fetchHistory(histPage + 1); }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                histHasMore ? <ActivityIndicator color={PRIMARY} style={{ marginVertical: 12 }} /> : null
              }
              ListEmptyComponent={<EmptyState label={t('noDeliveriesHistory')} />}
            />
          )}
        </>
      )}

      {/* ── Category Picker ───────────────────────────────────────────── */}
      <Modal visible={showCatePicker} transparent animationType="slide" onRequestClose={() => setShowCatePicker(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowCatePicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('filterByCategory')}</Text>
            <TouchableOpacity onPress={() => setShowCatePicker(false)}>
              <MaterialIcons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            <TouchableOpacity
              style={[styles.catePickRow, !selCate && styles.catePickRowActive]}
              onPress={() => { selectCate(null); setShowCatePicker(false); }}
            >
              <Text style={[styles.catePickText, !selCate && { color: PRIMARY, fontWeight: '700' }]}>{t('allCategories')}</Text>
              {!selCate && <MaterialIcons name="check" size={18} color={PRIMARY} />}
            </TouchableOpacity>
            {cates.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catePickRow, selCate?.id === c.id && styles.catePickRowActive]}
                onPress={() => { selectCate(c); setShowCatePicker(false); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catePickText, selCate?.id === c.id && { color: PRIMARY, fontWeight: '700' }]}>{c.name}</Text>
                  {c.d_time && <Text style={styles.catePickTime}>{c.d_time}</Text>}
                </View>
                {selCate?.id === c.id && <MaterialIcons name="check" size={18} color={PRIMARY} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Checklist Popup ───────────────────────────────────────────── */}
      <ChecklistModal
        item={checklistItem}
        onClose={() => setChecklistItem(null)}
        onSaved={() => fetchToday(1, true)}
      />

      <PrintDeliveryModal
        visible={showPrint}
        onClose={() => setShowPrint(false)}
      />

      <DateRangeCalendarModal
        visible={showUpcomDatePicker}
        start={upcomingFrom}
        end={upcomingTo}
        minDate={defaultUpcomingDate()}
        onClose={() => setShowUpcomDatePicker(false)}
        onApply={(start, end) => {
          setUpcomingFrom(start);
          setUpcomingTo(end);
          fetchUpcoming(1, selCate, { from: start, to: end });
        }}
      />

      <DateRangeCalendarModal
        visible={showHistDatePicker}
        start={historyFrom}
        end={historyTo}
        maxDate={startOfToday()}
        onClose={() => setShowHistDatePicker(false)}
        onApply={(start, end) => {
          setHistoryFrom(start);
          setHistoryTo(end);
          fetchHistory(1, selCate, { from: start, to: end });
        }}
      />
    </View>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.emptyWrap}>
      <MaterialIcons name="inbox" size={48} color="#cbd5e1" />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  // Header
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  printHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  printHeaderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Main tabs
  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:           { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  tabActive:     { borderBottomWidth: 2.5, borderBottomColor: PRIMARY },
  tabText:       { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: PRIMARY },

  rangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rangeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeTexts: { flex: 1 },
  rangeTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 2 },
  rangeValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  // Category filter button
  cateBar:          { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cateBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start', maxWidth: '100%' },
  cateBtnText:      { fontSize: 13, fontWeight: '600', color: '#64748b', flex: 1 },
  catePickRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  catePickRowActive:{ backgroundColor: '#f0ebff', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  catePickText:     { fontSize: 14, color: '#0f172a' },
  catePickTime:     { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Delivery list
  listContent:     { padding: 14, paddingBottom: 24 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },

  // Bottom sheet (category filter)
  sheetOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12 },
  sheetHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 14 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle:     { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sheetSub:       { fontSize: 13, color: '#64748b', marginBottom: 14 },
});
