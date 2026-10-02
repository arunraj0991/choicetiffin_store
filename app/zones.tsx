import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { GOOGLE_MAPS_APIKEY } from '@/constants/maps';
import {
  storeZoneDelete,
  storeZones,
  storeZoneStatus,
  storeZoneStore,
  storeZoneUpdate,
} from '@/src/api/api';

const PRIMARY = COLORS.primary;

interface Zone {
  id:      number | string;
  name:    string;
  address: string;
  lat:     string | number;
  lng:     string | number;
  radius:  string | number;
  status:  number;
}

interface Prediction { place_id: string; description: string; }

// ── Google Places address input ───────────────────────────────────────────────

function AddressInput({ mapKey, value, onSelect }: {
  mapKey:   string;
  value:    string;
  onSelect: (address: string, lat: string, lng: string) => void;
}) {
  const [query,       setQuery]       = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [fetching,    setFetching]    = useState(false);
  const [showList,    setShowList]    = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = (text: string) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (!text.trim() || text.length < 3) { setPredictions([]); setShowList(false); return; }
    debounce.current = setTimeout(async () => {
      setFetching(true);
      try {
        const url  = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${mapKey}&language=en`;
        const res  = await fetch(url);
        const json = await res.json();
        if (json.status === 'OK') { setPredictions(json.predictions ?? []); setShowList(true); }
        else setPredictions([]);
      } catch { setPredictions([]); }
      finally { setFetching(false); }
    }, 350);
  };

  const pick = async (pred: Prediction) => {
    setQuery(pred.description);
    setPredictions([]);
    setShowList(false);
    try {
      const url  = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry&key=${mapKey}`;
      const res  = await fetch(url);
      const json = await res.json();
      const loc  = json.result?.geometry?.location;
      onSelect(pred.description, loc?.lat?.toString() ?? '', loc?.lng?.toString() ?? '');
    } catch {
      onSelect(pred.description, '', '');
    }
  };

  return (
    <View>
      <View style={s.addrWrap}>
        <MaterialIcons name="search" size={18} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput
          style={s.addrInput}
          value={query}
          onChangeText={search}
          placeholder="Search center point area…"
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
        />
        {fetching && <ActivityIndicator size="small" color={PRIMARY} style={{ marginLeft: 6 }} />}
        {query.length > 0 && !fetching && (
          <TouchableOpacity onPress={() => { setQuery(''); setPredictions([]); setShowList(false); onSelect('', '', ''); }}>
            <MaterialIcons name="close" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
      {showList && predictions.length > 0 && (
        <View style={s.suggBox}>
          {predictions.map(p => (
            <TouchableOpacity key={p.place_id} style={s.suggRow} onPress={() => pick(p)}>
              <MaterialIcons name="place" size={14} color={PRIMARY} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={s.suggTxt} numberOfLines={2}>{p.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Zone Form Modal ───────────────────────────────────────────────────────────

function ZoneFormModal({ visible, editing, mapKey, onClose, onSaved }: {
  visible:  boolean;
  editing:  Zone | null;
  mapKey:   string;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [lat,     setLat]     = useState('');
  const [lng,     setLng]     = useState('');
  const [radius,  setRadius]  = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '');
      setAddress(editing?.address ?? '');
      setLat(editing?.lat != null ? String(editing.lat) : '');
      setLng(editing?.lng != null ? String(editing.lng) : '');
      setRadius(editing?.radius != null ? String(editing.radius) : '');
    }
  }, [visible, editing]);

  const submit = async () => {
    if (!name.trim())    { Alert.alert('Error', 'Zone name is required.'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Center point address is required.'); return; }
    if (!lat || !lng)    { Alert.alert('Error', 'Please select an address from the suggestions to get coordinates.'); return; }
    if (!radius.trim())  { Alert.alert('Error', 'Delivery radius is required.'); return; }

    setSaving(true);
    try {
      const payload = { name, address, lat, lng, radius };
      editing ? await storeZoneUpdate(editing.id, payload) : await storeZoneStore(payload);
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{editing ? 'Edit Zone' : 'Add Zone'}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <View style={s.field}>
              <Text style={s.label}>Zone Name *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. North Area, City Center"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Center Point Area *</Text>
              <AddressInput
                mapKey={mapKey}
                value={address}
                onSelect={(addr, lt, lg) => { setAddress(addr); setLat(lt); setLng(lg); }}
              />
              {address && lat ? (
                <View style={s.coordRow}>
                  <MaterialIcons name="my-location" size={13} color="#16a34a" />
                  <Text style={s.coordTxt}>{parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.field}>
              <Text style={s.label}>Delivery Radius (km) *</Text>
              <TextInput
                style={s.input}
                value={radius}
                onChangeText={setRadius}
                placeholder="e.g. 5  (delivers within 5 km radius)"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />
              <Text style={s.fieldHint}>All orders within this radius from the center point will be in this zone</Text>
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <><MaterialIcons name="check" size={18} color="#fff" /><Text style={s.submitBtnText}>{editing ? 'Update Zone' : 'Add Zone'}</Text></>}
            </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Zones() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [zones,      setZones]      = useState<Zone[]>([]);
  const [mapKey,     setMapKey]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Zone | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await storeZones();
      setZones(res.data?.zones ?? res.data ?? []);
      setMapKey(res.data?.map_key || GOOGLE_MAPS_APIKEY);
    } catch {
      Alert.alert('Error', 'Failed to load zones.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openAdd  = () => { setEditing(null); setShowForm(true); };
  const openEdit = (z: Zone) => { setEditing(z); setShowForm(true); };

  const toggleStatus = async (z: Zone) => {
    try {
      await storeZoneStatus(z.id);
      setZones(prev => prev.map(x => x.id === z.id ? { ...x, status: x.status === 0 ? 1 : 0 } : x));
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const confirmDelete = (z: Zone) => {
    Alert.alert('Delete Zone', `Delete "${z.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await storeZoneDelete(z.id);
            setZones(prev => prev.filter(x => x.id !== z.id));
          } catch {
            Alert.alert('Error', 'Failed to delete. Zone may be in use.');
          }
        },
      },
    ]);
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Delivery Zones</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <MaterialIcons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
        >
          {/* Info banner */}
          <View style={s.infoBanner}>
            <MaterialIcons name="info-outline" size={16} color={PRIMARY} />
            <Text style={s.infoBannerText}>
              Zones define delivery areas. When a customer places an order, the nearest active zone is auto-assigned based on their location.
            </Text>
          </View>

          {zones.length === 0 && (
            <View style={s.empty}>
              <MaterialIcons name="map" size={52} color="#cbd5e1" />
              <Text style={s.emptyTitle}>No zones yet</Text>
              <Text style={s.emptySub}>Add delivery zones to auto-assign orders and riders</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
                <MaterialIcons name="add" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add Zone</Text>
              </TouchableOpacity>
            </View>
          )}

          {zones.map(z => (
            <View key={z.id} style={s.card}>
              {/* Left: map pin icon */}
              <View style={[s.zoneIcon, z.status === 0 ? s.zoneIconActive : s.zoneIconOff]}>
                <MaterialIcons name="place" size={22} color={z.status === 0 ? PRIMARY : '#94a3b8'} />
              </View>

              {/* Center: info */}
              <View style={s.cardBody}>
                <View style={s.cardTop}>
                  <Text style={s.zoneName}>{z.name}</Text>
                  <TouchableOpacity
                    style={[s.statusBadge, z.status === 0 ? s.statusActive : s.statusOff]}
                    onPress={() => toggleStatus(z)}
                  >
                    <Text style={[s.statusText, { color: z.status === 0 ? '#16a34a' : '#94a3b8' }]}>
                      {z.status === 0 ? 'Active' : 'Disabled'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {z.address ? (
                  <View style={s.infoRow}>
                    <MaterialIcons name="my-location" size={12} color="#94a3b8" />
                    <Text style={s.infoText} numberOfLines={1}>{z.address}</Text>
                  </View>
                ) : null}

                <View style={s.infoRow}>
                  <MaterialIcons name="radio-button-checked" size={12} color="#94a3b8" />
                  <Text style={s.infoText}>{z.radius} km radius</Text>
                  {z.lat && z.lng ? (
                    <>
                      <View style={s.dot} />
                      <MaterialIcons name="gps-fixed" size={12} color="#94a3b8" />
                      <Text style={s.infoText}>{parseFloat(String(z.lat)).toFixed(4)}, {parseFloat(String(z.lng)).toFixed(4)}</Text>
                    </>
                  ) : null}
                </View>
              </View>

              {/* Right: actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(z)}>
                  <MaterialIcons name="edit" size={17} color={PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#fef2f2', marginTop: 6 }]} onPress={() => confirmDelete(z)}>
                  <MaterialIcons name="delete-outline" size={17} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ZoneFormModal
        visible={showForm}
        editing={editing}
        mapKey={mapKey}
        onClose={() => setShowForm(false)}
        onSaved={load}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  addBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  list: { padding: 14, gap: 12, paddingBottom: 40 },

  // Info banner
  infoBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#f0ebff', borderRadius: 12, padding: 12, marginBottom: 4 },
  infoBannerText: { flex: 1, fontSize: 12, color: PRIMARY, lineHeight: 18 },

  // Card
  card:        { backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  zoneIcon:    { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  zoneIconActive:{ backgroundColor: '#f0ebff' },
  zoneIconOff: { backgroundColor: '#f1f5f9' },
  cardBody:    { flex: 1 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  zoneName:    { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },

  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusOff:    { backgroundColor: '#f1f5f9' },
  statusText:   { fontSize: 11, fontWeight: '700' },

  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  infoText: { fontSize: 12, color: '#64748b', flex: 1 },
  dot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#cbd5e1', marginHorizontal: 2 },

  cardActions: { alignItems: 'center' },
  actionBtn:   { width: 34, height: 34, borderRadius: 10, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center' },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  emptySub:    { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 24 },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // Sheet
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 17, fontWeight: '800', color: '#0f172a' },

  // Form fields
  field:      { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldHint:  { fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 16 },
  input:      { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0f172a' },

  // Address autocomplete
  addrWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  addrInput: { flex: 1, fontSize: 14, color: '#0f172a', padding: 0 },
  suggBox:   { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  suggRow:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggTxt:   { flex: 1, fontSize: 13, color: '#0f172a', lineHeight: 18 },
  coordRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  coordTxt:  { fontSize: 11, color: '#16a34a', fontWeight: '600' },

  submitBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
