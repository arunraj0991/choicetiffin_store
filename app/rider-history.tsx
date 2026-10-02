import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { storeRiderHistory } from '../src/api/api';

type Cate = { id: number | string; name: string };
type Delivery = {
  id: number;
  delivery_date: string;
  delivery_status: string;
  meal_name: string;
  mealType: string;
  user_name: string;
  user_phone: string;
  address: string;
  house_no: string | null;
  zone_name: string | null;
  rider_fee: number | string | null;
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  delivered: { bg: '#dcfce7', text: '#16a34a' },
  scheduled: { bg: '#dbeafe', text: '#2563eb' },
  skipped:   { bg: '#fee2e2', text: '#dc2626' },
};

export default function RiderHistoryScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { rider_id, rider_name } = useLocalSearchParams<{ rider_id: string; rider_name: string }>();

  const [loading,     setLoading]     = useState(true);
  const [deliveries,  setDeliveries]  = useState<Delivery[]>([]);
  const [cates,       setCates]       = useState<Cate[]>([]);
  const [selCate,     setSelCate]     = useState<Cate | null>(null);
  const [showCatePicker, setShowCatePicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeRiderHistory(rider_id, selCate?.id);
      const d   = res.data;
      setDeliveries(d.data?.data || d.data || []);
      setCates(d.cates || []);
    } catch {
      Alert.alert('Error', 'Failed to load delivery history.');
    } finally {
      setLoading(false);
    }
  }, [rider_id, selCate]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Delivery card ─────────────────────────────────────────────────────────
  const DeliveryCard = ({ item }: { item: Delivery }) => {
    const sc = STATUS_COLOR[item.delivery_status] || { bg: '#f3f4f6', text: '#6b7280' };
    const fullAddress = [item.house_no, item.address, item.zone_name].filter(Boolean).join(', ');

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.dateBox}>
            <Text style={s.dateDay}>{new Date(item.delivery_date).getDate()}</Text>
            <Text style={s.dateMon}>{new Date(item.delivery_date).toLocaleString('en-IN', { month: 'short' })}</Text>
          </View>
          <View style={s.cardBody}>
            <View style={s.cardRow}>
              <Text style={s.mealName} numberOfLines={1}>{item.meal_name}</Text>
              <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[s.statusText, { color: sc.text }]}>
                  {item.delivery_status.charAt(0).toUpperCase() + item.delivery_status.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={s.mealType}>{item.mealType}</Text>
            <View style={s.custRow}>
              <Ionicons name="person-outline" size={12} color="#9ca3af" style={{ marginRight: 4 }} />
              <Text style={s.custName}>{item.user_name}</Text>
              {item.user_phone ? <Text style={s.custPhone}> · {item.user_phone}</Text> : null}
            </View>
            <View style={s.addrRow}>
              <Ionicons name="location-outline" size={12} color="#9ca3af" style={{ marginRight: 4 }} />
              <Text style={s.addrText} numberOfLines={1}>{fullAddress}</Text>
            </View>
          </View>
        </View>
        {item.rider_fee ? (
          <View style={s.feeRow}>
            <Ionicons name="cash-outline" size={12} color="#7c3aed" style={{ marginRight: 4 }} />
            <Text style={s.feeText}>Rider fee: {item.rider_fee}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ── Category filter button ────────────────────────────────────────────────
  const CateFilterBtn = () => (
    <TouchableOpacity style={s.cateBtn} onPress={() => setShowCatePicker(true)}>
      <Ionicons name="filter-outline" size={15} color={selCate ? '#7c3aed' : '#666'} style={{ marginRight: 6 }} />
      <Text style={[s.cateBtnText, selCate && { color: '#7c3aed' }]}>
        {selCate ? selCate.name : 'All Categories'}
      </Text>
      <Ionicons name="chevron-down" size={14} color={selCate ? '#7c3aed' : '#aaa'} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Delivery History</Text>
          <Text style={s.headerSub}>{decodeURIComponent(rider_name || '')}</Text>
        </View>
      </View>

      <View style={s.filterBar}>
        <CateFilterBtn />
        {selCate && (
          <TouchableOpacity style={s.clearBtn} onPress={() => setSelCate(null)}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={d => String(d.id)}
          renderItem={({ item }) => <DeliveryCard item={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="map-outline" size={48} color="#ddd" />
              <Text style={s.emptyText}>No deliveries found</Text>
            </View>
          }
        />
      )}

      {/* ── Category picker modal ── */}
      <Modal visible={showCatePicker} transparent animationType="slide" onRequestClose={() => setShowCatePicker(false)}>
        <View style={s.overlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Filter by Category</Text>

            <TouchableOpacity
              style={[s.pickerRow, !selCate && s.pickerRowActive]}
              onPress={() => { setSelCate(null); setShowCatePicker(false); }}
            >
              <Text style={[s.pickerRowText, !selCate && s.pickerRowTextActive]}>All Categories</Text>
              {!selCate && <Ionicons name="checkmark" size={16} color="#7c3aed" />}
            </TouchableOpacity>

            {cates.map(c => (
              <TouchableOpacity
                key={String(c.id)}
                style={[s.pickerRow, selCate?.id === c.id && s.pickerRowActive]}
                onPress={() => { setSelCate(c); setShowCatePicker(false); }}
              >
                <Text style={[s.pickerRowText, selCate?.id === c.id && s.pickerRowTextActive]}>{c.name}</Text>
                {selCate?.id === c.id && <Ionicons name="checkmark" size={16} color="#7c3aed" />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f5f5f7' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 12 },
  backBtn:    { marginRight: 4 },
  headerTitle:{ fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerSub:  { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  filterBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 },
  cateBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  cateBtnText:{ fontSize: 13, fontWeight: '600', color: '#555' },
  clearBtn:   { padding: 2 },

  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start' },
  dateBox:    { width: 44, alignItems: 'center', backgroundColor: '#f0e7ff', borderRadius: 10, paddingVertical: 6, marginRight: 12 },
  dateDay:    { fontSize: 18, fontWeight: '900', color: '#7c3aed', lineHeight: 22 },
  dateMon:    { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
  cardBody:   { flex: 1 },
  cardRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  mealName:   { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  mealType:   { fontSize: 11, color: '#9ca3af', marginBottom: 6 },
  statusBadge:{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  custRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  custName:   { fontSize: 12, color: '#374151', fontWeight: '600' },
  custPhone:  { fontSize: 12, color: '#9ca3af' },
  addrRow:    { flexDirection: 'row', alignItems: 'center' },
  addrText:   { fontSize: 12, color: '#6b7280', flex: 1 },
  feeRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  feeText:    { fontSize: 12, color: '#7c3aed', fontWeight: '600' },

  emptyBox:   { alignItems: 'center', paddingTop: 80 },
  emptyText:  { fontSize: 15, color: '#bbb', marginTop: 12 },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet:  { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  pickerHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle:  { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerRowActive: { backgroundColor: '#faf5ff', marginHorizontal: -20, paddingHorizontal: 20, borderRadius: 0 },
  pickerRowText:   { fontSize: 14, color: '#374151', fontWeight: '500' },
  pickerRowTextActive: { color: '#7c3aed', fontWeight: '700' },
});
