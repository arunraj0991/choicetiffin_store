import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
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
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { useAppRefresh } from '@/src/appRefresh';
import { useLanguage } from '@/src/i18n/context';
import {
  storeCancelSubscription,
  storeCompleteSubscription,
  storeAssignZone,
  storeOrders,
  storePauseSubscription,
  storeResumeSubscription,
  storeViewOrder,
  storeZones,
} from '@/src/api/api';

const PRIMARY = COLORS.primary;

type TabKey = 'Today' | 'Upcoming';
type OrderStatus = 'Active' | 'Paused' | 'Completed' | 'Cancelled';
const TAB_KEYS: TabKey[] = ['Today', 'Upcoming'];

interface Order {
  id:          number;
  uid:         string;
  name:        string;
  phone:       string;
  email:       string;
  address:     string;
  house_no:    string;
  addressType: string;
  zone_name:   string | null;
  distance:    number | null;
  status:      OrderStatus;
  status_date: string | null;
  storeTotal:  number;
  sub_total:   number;
  d_fee:       number | null;
  created_at:  string;
}
interface Zone        { id: number; name: string; }
interface OrderItem   {
  id: number;
  name: string;
  type: string;
  start: string;
  end: string;
  des?: string | null;
  desc?: string | null;
  description?: string | null;
}
interface OrderDetail { order: Order & { payment_method: string }; items: OrderItem[]; }

function itemDescription(item: OrderItem): string {
  const raw = item.des ?? item.desc ?? item.description ?? '';
  return String(raw).trim();
}

const STATUS_STYLE: Record<OrderStatus, { bg: string; text: string }> = {
  Active:    { bg: '#f0ebff', text: PRIMARY },
  Paused:    { bg: '#fef3c7', text: '#d97706' },
  Completed: { bg: '#dcfce7', text: '#16a34a' },
  Cancelled: { bg: '#fee2e2', text: '#dc2626' },
};

const mkState = <T,>(v: T): Record<TabKey, T> =>
  ({ Today: v, Upcoming: v } as Record<TabKey, T>);

export default function Subscriptions() {
  const headerPad = useSafeHeaderPad();
  const router  = useRouter();
  const { t }   = useLanguage();

  const [activeTab,      setActiveTab]      = useState<TabKey>('Today');
  const [lists,          setLists]          = useState<Record<TabKey, Order[]>>(mkState([]));
  const [pages,          setPages]          = useState<Record<TabKey, number>>(mkState(1));
  const [hasMore,        setHasMore]        = useState<Record<TabKey, boolean>>(mkState(true));
  const [loading,        setLoading]        = useState<Record<TabKey, boolean>>(mkState(true));
  const [refreshing,     setRefreshing]     = useState(false);

  // action sheet
  const [selected,       setSelected]       = useState<Order | null>(null);
  const [actionOpen,     setActionOpen]     = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);

  // detail modal
  const [detail,         setDetail]         = useState<OrderDetail | null>(null);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailLoading,  setDetailLoading]  = useState(false);

  // zone picker
  const [zones,          setZones]          = useState<Zone[]>([]);
  const [zoneOpen,       setZoneOpen]       = useState(false);
  const [zoneLoading,    setZoneLoading]    = useState(false);
  const [assigningZone,  setAssigningZone]  = useState(false);

  useEffect(() => { fetchTab(activeTab, 1, true); }, [activeTab]);

  const fetchTab = async (tab: TabKey, page: number, reset = false) => {
    if (page === 1) setLoading(p => ({ ...p, [tab]: true }));
    try {
      // Today tab shows Active subscriptions from the API
      const status = tab === 'Today' ? 'Active' : 'Upcoming';
      const res  = await storeOrders(status, page);
      const rows: Order[] = res.data?.data ?? [];
      const last = res.data?.last_page ?? 1;
      setLists(p  => ({ ...p, [tab]: reset ? rows : [...p[tab], ...rows] }));
      setPages(p  => ({ ...p, [tab]: page }));
      setHasMore(p => ({ ...p, [tab]: page < last }));
    } catch {
      if (page === 1) setLists(p => ({ ...p, [tab]: [] }));
    } finally {
      setLoading(p => ({ ...p, [tab]: false }));
      setRefreshing(false);
    }
  };

  useAppRefresh(
    useCallback(() => {
      fetchTab(activeTab, 1, true);
    }, [activeTab]),
  );

  const refreshAll = () => TAB_KEYS.forEach(tab => fetchTab(tab, 1, true));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTab(activeTab, 1, true);
  }, [activeTab]);

  const loadMore = () => {
    if (!hasMore[activeTab] || loading[activeTab]) return;
    fetchTab(activeTab, pages[activeTab] + 1);
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const openAction = (order: Order) => { setSelected(order); setActionOpen(true); };

  const doAction = async (action: 'pause' | 'resume' | 'cancel' | 'complete') => {
    if (!selected) return;
    const msg = action === 'pause'    ? t('pauseConfirm')
              : action === 'resume'   ? t('resumeConfirm')
              : action === 'cancel'   ? t('cancelConfirm')
              :                         t('completeConfirm');

    Alert.alert(t('confirm'), msg, [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'), style: action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          setActionLoading(true);
          try {
            const fn = action === 'pause'    ? storePauseSubscription
                     : action === 'resume'   ? storeResumeSubscription
                     : action === 'cancel'   ? storeCancelSubscription
                     :                         storeCompleteSubscription;
            const res = await fn(selected.id);
            setActionOpen(false);
            setSelected(null);
            refreshAll();
            if (res.msg !== 'done' && res.status !== true && res.status !== 'success') {
              Alert.alert(t('error'), res.error || res.message || t('somethingWentWrong'));
            }
          } catch {
            Alert.alert(t('error'), t('networkErrorTryAgain'));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const openDetail = async (order: Order) => {
    setActionOpen(false);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await storeViewOrder(order.id);
      const data = res.data;
      if (__DEV__ && data?.items?.[0]) {
        console.log('Order item keys:', Object.keys(data.items[0]));
      }
      setDetail(data);
    } catch {
      Alert.alert(t('error'), t('failedLoadOrder'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Zone assignment ───────────────────────────────────────────────────────────

  const openZonePicker = async (order: Order) => {
    setActionOpen(false);
    setSelected(order);
    setZoneOpen(true);
    setZoneLoading(true);
    try {
      const res = await storeZones();
      setZones(res.data ?? []);
    } catch {
      Alert.alert(t('error'), t('failedAssignZone'));
      setZoneOpen(false);
    } finally {
      setZoneLoading(false);
    }
  };

  const assignZone = async (zone: Zone) => {
    if (!selected) return;
    setAssigningZone(true);
    try {
      const res = await storeAssignZone(selected.id, zone.id);
      setZoneOpen(false);
      setSelected(null);
      refreshAll();
      if (res.msg !== 'done' && res.status !== true && res.status !== 'success') {
        Alert.alert(t('error'), res.error || res.message || t('failedAssignZone'));
      }
    } catch {
      Alert.alert(t('error'), t('networkErrorTryAgain'));
    } finally {
      setAssigningZone(false);
    }
  };

  // ── Tab label map ─────────────────────────────────────────────────────────────

  const tabLabel = (tab: TabKey) =>
    tab === 'Today' ? t('today') : t('upcoming');

  const statusLabel = (status: OrderStatus) =>
    status === 'Active'    ? t('active')
    : status === 'Paused'  ? t('paused')
    : status === 'Completed' ? t('completed')
    : t('cancelled');

  // ── Render card ──────────────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: Order }) => {
      console.log(item)
    const ss   = STATUS_STYLE[item.status] ?? { bg: '#f1f5f9', text: '#64748b' };
    const date = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>{item.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardPhone}>{item.phone}</Text>
          </View>
          <TouchableOpacity style={styles.dotBtn} onPress={() => openAction(item)}>
            <MaterialIcons name="more-vert" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardRow}>
          <MaterialIcons name="place" size={14} color="#94a3b8" />
          <Text style={styles.cardAddr} numberOfLines={1}>
            {[item.house_no, item.address].filter(Boolean).join(', ')}
          </Text>
        </View>

        {item.zone_name ? (
          <View style={styles.cardRow}>
            <MaterialIcons name="map" size={14} color={PRIMARY} />
            <Text style={styles.cardZone}>
              {item.zone_name}{item.distance ? ` • ${item.distance} km` : ''}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.cardRow} onPress={() => openZonePicker(item)}>
            <MaterialIcons name="add-location-alt" size={14} color="#ef4444" />
            <Text style={styles.cardNoZone}>{t('tapAssignZone')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{date}</Text>
          <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
            <Text style={[styles.statusBadgeText, { color: ss.text }]}>{statusLabel(item.status)}</Text>
          </View>
          {/* <Text style={styles.cardTotal}>₹{item.storeTotal}</Text> */}
        </View>
      </View>
    );
  };

  const current   = lists[activeTab];
  const isLoading = loading[activeTab];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscriptionsTitle')}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TAB_KEYS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tabLabel(tab)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isLoading && current.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={current}
          keyExtractor={item => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore[activeTab] && !isLoading
            ? <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
            : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t('noSubscriptions')}</Text>
            </View>
          }
        />
      )}

      {/* ── Action Sheet ─────────────────────────────────────────────────────── */}
      <Modal visible={actionOpen} transparent animationType="slide" onRequestClose={() => setActionOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setActionOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {selected && (
            <>
              <Text style={styles.sheetTitle}>{selected.name}</Text>
              <Text style={styles.sheetSub}>#{selected.id} • ₹{selected.storeTotal}</Text>

              <ActionRow icon="visibility" label={t('viewDetails')} onPress={() => openDetail(selected)} loading={false} />
              <ActionRow
                icon="check-circle-outline"
                label={t('markCompleted')}
                color="#16a34a"
                onPress={() => doAction('complete')}
                loading={actionLoading}
              />

              <TouchableOpacity style={styles.sheetCancel} onPress={() => setActionOpen(false)}>
                <Text style={styles.sheetCancelText}>{t('close')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* ── Zone Picker ──────────────────────────────────────────────────────── */}
      <Modal visible={zoneOpen} transparent animationType="slide" onRequestClose={() => setZoneOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setZoneOpen(false)} />
        <View style={[styles.sheet, { maxHeight: '60%' }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('assignDeliveryZone')}</Text>
          <Text style={styles.sheetSub}>{t('selectZoneFor')} {selected?.name}</Text>

          {zoneLoading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 24 }} />
          ) : zones.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="map" size={36} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t('noZonesFound')}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {zones.map(zone => (
                <TouchableOpacity
                  key={zone.id}
                  style={styles.zoneRow}
                  onPress={() => assignZone(zone)}
                  disabled={assigningZone}
                >
                  <View style={styles.zoneIconBg}>
                    <MaterialIcons name="location-on" size={18} color={PRIMARY} />
                  </View>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  {assigningZone
                    ? <ActivityIndicator size="small" color={PRIMARY} />
                    : <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.sheetCancel} onPress={() => setZoneOpen(false)}>
            <Text style={styles.sheetCancelText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Order Detail ─────────────────────────────────────────────────────── */}
      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{t('orderDetails')}</Text>
              <TouchableOpacity onPress={() => setDetailOpen(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={PRIMARY} />
              </View>
            ) : detail ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
                <View style={styles.detailSection}>
                  <DetailRow label={t('name')} value={detail.order.name} />
                </View>

                {detail.items.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>{t('mealItems')}</Text>
                    {detail.items.map(item => {
                      const desc = itemDescription(item);
                      return (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={styles.itemBullet} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {!!desc && (
                            <Text style={styles.itemDesc}>{desc}</Text>
                          )}
                          <Text style={styles.itemMeta}>{item.type} • {item.start} → {item.end}</Text>
                        </View>
                      </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.detailSection}>
                  {/* <DetailRow label={t('status')} value={detail.order.status} /> */}
                  {detail.order.status_date && (
                    <DetailRow label={t('statusDate')} value={detail.order.status_date} />
                  )}
                </View>

                {/* {(detail.order.status === 'Active' || detail.order.status === 'Paused') && (
                  <View style={styles.detailActions}>
                    {detail.order.status === 'Active' && (
                      <>
                        <ActionBtn color="#d97706" bg="#fef3c7" icon="pause"  label={t('pause')}    onPress={() => { setDetailOpen(false); setTimeout(() => { setSelected(detail.order as any); doAction('pause'); }, 300); }} />
                        <ActionBtn color="#16a34a" bg="#dcfce7" icon="check"  label={t('complete')} onPress={() => { setDetailOpen(false); setTimeout(() => { setSelected(detail.order as any); doAction('complete'); }, 300); }} />
                        <ActionBtn color="#dc2626" bg="#fee2e2" icon="close"  label={t('cancel')}   onPress={() => { setDetailOpen(false); setTimeout(() => { setSelected(detail.order as any); doAction('cancel'); }, 300); }} />
                      </>
                    )}
                    {detail.order.status === 'Paused' && (
                      <>
                        <ActionBtn color="#16a34a" bg="#dcfce7" icon="play-arrow" label={t('resume')} onPress={() => { setDetailOpen(false); setTimeout(() => { setSelected(detail.order as any); doAction('resume'); }, 300); }} />
                        <ActionBtn color="#dc2626" bg="#fee2e2" icon="close"      label={t('cancel')} onPress={() => { setDetailOpen(false); setTimeout(() => { setSelected(detail.order as any); doAction('cancel'); }, 300); }} />
                      </>
                    )}
                  </View>
                )} */}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function ActionRow({ icon, label, color = '#0f172a', onPress, loading }: { icon: any; label: string; color?: string; onPress: () => void; loading: boolean }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} disabled={loading}>
      <View style={[styles.actionIconBg, { backgroundColor: color + '18' }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      {loading && <ActivityIndicator size="small" color={color} style={{ marginLeft: 'auto' }} />}
    </TouchableOpacity>
  );
}

function ActionBtn({ icon, label, color, bg, onPress }: { icon: any; label: string; color: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.detailActionBtn, { backgroundColor: bg }]} onPress={onPress}>
      <MaterialIcons name={icon} size={16} color={color} />
      <Text style={[styles.detailActionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && { fontWeight: '800', color: '#0f172a' }]}>{value ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  // Header
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },

  // Tabs
  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2.5, borderBottomColor: PRIMARY },
  tabText:       { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  tabTextActive: { color: PRIMARY },

  // List
  listContent: { padding: 14, gap: 12 },
  empty:       { alignItems: 'center', paddingVertical: 60 },
  emptyText:   { color: '#94a3b8', fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },

  // Card
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cardAvatarText: { color: PRIMARY, fontSize: 16, fontWeight: '800' },
  cardMeta:       { flex: 1 },
  cardName:       { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  cardPhone:      { fontSize: 12, color: '#64748b', marginTop: 1 },
  dotBtn:         { padding: 4 },
  cardRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  cardAddr:       { fontSize: 12, color: '#64748b', flex: 1 },
  cardZone:       { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  cardNoZone:     { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  cardDate:       { fontSize: 11, color: '#94a3b8' },
  statusBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText:{ fontSize: 11, fontWeight: '700' },
  cardTotal:      { fontSize: 14, fontWeight: '800', color: '#0f172a' },

  // Sheet (shared)
  sheetOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:           { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12 },
  sheetHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:      { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  sheetSub:        { fontSize: 13, color: '#64748b', marginBottom: 16 },
  sheetCancel:     { marginTop: 16, height: 46, backgroundColor: '#f1f5f9', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  sheetCancelText: { fontSize: 15, fontWeight: '700', color: '#64748b' },

  // Action rows (in action sheet)
  actionRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  actionIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionLabel:  { fontSize: 15, fontWeight: '600' },

  // Zone picker rows
  zoneRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
  zoneIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center' },
  zoneName:   { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },

  // Detail modal
  detailOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingTop: 12 },
  detailHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailTitle:        { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  detailSection:      { marginHorizontal: 20, marginTop: 20 },
  detailSectionTitle: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  detailLabel:        { fontSize: 13, color: '#64748b' },
  detailValue:        { fontSize: 13, fontWeight: '600', color: '#334155', flex: 1, textAlign: 'right' },
  itemRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  itemBullet:         { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 5 },
  itemName:           { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  itemDesc:           { fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 17 },
  itemMeta:           { fontSize: 12, color: '#64748b', marginTop: 2 },
  detailActions:      { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, gap: 10 },
  detailActionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  detailActionText:   { fontSize: 13, fontWeight: '700' },
});
