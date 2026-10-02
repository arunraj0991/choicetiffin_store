import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
  Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';

const PRIMARY = COLORS.primary;
import {
  storeRiders, storeRiderStore, storeRiderUpdate,
  storeRiderDelete, storeRiderStatus,
} from '../src/api/api';

type Zone  = { id: number | string; name: string };
type Rider = {
  id: string;
  name: string;
  email: string;
  phone: string;
  img: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  d_fee: number | string | null;
  status: number;
  is_active: number;
  zone_ids: (number | string)[];
};

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Car', 'Bicycle', 'Three-Wheeler'];

export default function RidersScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [riders,   setRiders]   = useState<Rider[]>([]);
  const [zones,    setZones]    = useState<Zone[]>([]);
  const [imgBase,  setImgBase]  = useState('');
  const [loading,  setLoading]  = useState(true);
  const [detail,   setDetail]   = useState<Rider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Rider | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await storeRiders();
      const d   = res.data || res;
      setRiders(d.riders    || []);
      setZones(d.zones      || []);
      setImgBase(d.img_base || '');
    } catch {
      Alert.alert('Error', 'Failed to load riders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (rider: Rider) => {
    const next = rider.status === 0 ? 1 : 0;
    setRiders(prev => prev.map(r => r.id === rider.id ? { ...r, status: next } : r));
    if (detail?.id === rider.id) setDetail(d => d ? { ...d, status: next } : d);
    try {
      await storeRiderStatus(rider.id);
    } catch {
      setRiders(prev => prev.map(r => r.id === rider.id ? { ...r, status: rider.status } : r));
      if (detail?.id === rider.id) setDetail(d => d ? { ...d, status: rider.status } : d);
    }
  };

  const handleDelete = (rider: Rider) => {
    Alert.alert('Delete Rider', `Remove "${rider.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await storeRiderDelete(rider.id);
            setRiders(prev => prev.filter(r => r.id !== rider.id));
            setDetail(null);
          } catch {
            Alert.alert('Error', 'Failed to delete rider.');
          }
        },
      },
    ]);
  };

  const getZoneName = (id: number | string) =>
    zones.find(z => String(z.id) === String(id))?.name || String(id);

  const avatarSource = (r: Rider) =>
    r.img ? { uri: `${imgBase}/${r.img}` } : null;

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // ── List row ─────────────────────────────────────────────────────────────────
  const RiderRow = ({ item }: { item: Rider }) => {
    const src = avatarSource(item);
    return (
      <TouchableOpacity style={s.row} onPress={() => setDetail(item)} activeOpacity={0.75}>
        <View style={s.avatarWrap}>
          {src
            ? <Image source={src} style={s.avatar} resizeMode="cover" />
            : <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{initials(item.name)}</Text>
              </View>
          }
          {item.is_active === 1 && <View style={s.onlineDot} />}
        </View>

        <View style={s.rowBody}>
          <Text style={s.rowName}>{item.name}</Text>
          <Text style={s.rowPhone}>{item.phone}</Text>
        </View>

        <Switch
          value={item.status === 0}
          onValueChange={() => toggleStatus(item)}
          trackColor={{ false: '#e5e7eb', true: '#a78bfa' }}
          thumbColor={item.status === 0 ? '#7c3aed' : '#9ca3af'}
        />
      </TouchableOpacity>
    );
  };

  // ── Detail modal ─────────────────────────────────────────────────────────────
  const DetailModal = () => {
    if (!detail) return null;
    const src = avatarSource(detail);

    const navAction = (path: string) => {
      setDetail(null);
      router.push(`${path}?rider_id=${detail.id}&rider_name=${encodeURIComponent(detail.name)}` as any);
    };

    return (
      <Modal visible animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />

            <TouchableOpacity style={s.closeBtn} onPress={() => setDetail(null)}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ── Profile head ── */}
              <View style={s.detailHead}>
                <View style={s.detailAvatarWrap}>
                  {src
                    ? <Image source={src} style={s.detailAvatar} resizeMode="cover" />
                    : <View style={[s.detailAvatar, s.detailAvatarPh]}>
                        <Text style={s.detailInitials}>{initials(detail.name)}</Text>
                      </View>
                  }
                  {detail.is_active === 1 && <View style={s.onlineDotLg} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailName}>{detail.name}</Text>
                  <View style={s.detailMeta}>
                    <View style={[s.statusPill, detail.status === 0 ? s.pillGreen : s.pillRed]}>
                      <Text style={[s.pillText, detail.status === 0 ? s.pillGreenText : s.pillRedText]}>
                        {detail.status === 0 ? 'Active' : 'Disabled'}
                      </Text>
                    </View>
                    {detail.is_active === 1 && (
                      <View style={s.onlinePill}>
                        <View style={s.onlineDotSm} />
                        <Text style={s.onlineLabel}>Online</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* ── Info rows ── */}
              <View style={s.infoBox}>
                <InfoRow icon="call-outline"    label="Phone"        val={detail.phone || '—'} />
                <InfoRow icon="mail-outline"    label="Email"        val={detail.email || '—'} last={!detail.vehicle_type && !detail.vehicle_number && !detail.d_fee} />
                {(detail.vehicle_type || detail.vehicle_number) && (
                  <InfoRow icon="bicycle-outline" label="Vehicle"
                    val={[detail.vehicle_type, detail.vehicle_number].filter(Boolean).join(' · ')}
                    last={!detail.d_fee} />
                )}
                {!!detail.d_fee && (
                  <InfoRow icon="cash-outline" label="Delivery Fee" val={String(detail.d_fee)} last />
                )}
              </View>

              {/* ── Zones ── */}
              {detail.zone_ids?.length > 0 && (
                <View style={s.zonesBox}>
                  <Text style={s.zonesLabel}>Assigned Zones</Text>
                  <View style={s.zonePills}>
                    {detail.zone_ids.map(zid => (
                      <View key={String(zid)} style={s.zonePill}>
                        <Ionicons name="location-outline" size={11} color="#7c3aed" />
                        <Text style={s.zonePillText}>{getZoneName(zid)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Actions ── */}
              <View style={s.actionsBox}>
                <ActionRow
                  icon="cash-outline"
                  iconBg="#ede9fe"
                  iconColor="#7c3aed"
                  label="Earning & Payout History"
                  onPress={() => navAction('/rider-payout')}
                />
                <ActionRow
                  icon="map-outline"
                  iconBg="#dbeafe"
                  iconColor="#2563eb"
                  label="Delivery History"
                  onPress={() => navAction('/rider-history')}
                />
                <ActionRow
                  icon="pencil-outline"
                  iconBg="#f3f4f6"
                  iconColor="#374151"
                  label="Edit Rider"
                  onPress={() => { setDetail(null); setEditing(detail); setShowForm(true); }}
                />
                <ActionRow
                  icon="trash-outline"
                  iconBg="#fee2e2"
                  iconColor="#dc2626"
                  label="Delete Rider"
                  labelColor="#dc2626"
                  onPress={() => handleDelete(detail)}
                  last
                />
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Form modal ───────────────────────────────────────────────────────────────
  const RiderFormModal = () => {
    const [tab,      setTab]      = useState(0);
    const [saving,   setSaving]   = useState(false);
    const [name,     setName]     = useState(editing?.name           || '');
    const [email,    setEmail]    = useState(editing?.email          || '');
    const [phone,    setPhone]    = useState(editing?.phone          || '');
    const [pass,     setPass]     = useState('');
    const [vType,    setVType]    = useState(editing?.vehicle_type   || '');
    const [vNum,     setVNum]     = useState(editing?.vehicle_number || '');
    const [dFee,     setDFee]     = useState(editing?.d_fee ? String(editing.d_fee) : '');
    const [selZones, setSelZones] = useState<(number | string)[]>(editing?.zone_ids || []);

    const toggleZone = (id: number | string) =>
      setSelZones(prev =>
        prev.some(z => String(z) === String(id))
          ? prev.filter(z => String(z) !== String(id))
          : [...prev, id]
      );

    const save = async () => {
      if (!name.trim())  { Alert.alert('Validation', 'Name is required.'); return; }
      if (!phone.trim()) { Alert.alert('Validation', 'Phone is required.'); return; }
      if (!editing && !pass.trim()) { Alert.alert('Validation', 'Password is required for new rider.'); return; }

      setSaving(true);
      try {
        const fd = new FormData() as any;
        fd.append('name',  name.trim());
        fd.append('email', email.trim());
        fd.append('phone', phone.trim());
        if (pass.trim())  fd.append('password',       pass.trim());
        if (vType.trim()) fd.append('vehicle_type',   vType.trim());
        if (vNum.trim())  fd.append('vehicle_number', vNum.trim());
        if (dFee.trim())  fd.append('d_fee',          dFee.trim());
        selZones.forEach(z => fd.append('zone_id[]', String(z)));

        editing ? await storeRiderUpdate(editing.id, fd) : await storeRiderStore(fd);
        setShowForm(false);
        load();
      } catch {
        Alert.alert('Error', 'Failed to save rider.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal visible animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.formHeader, { paddingTop: headerPad }]}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={22} color="#555" />
            </TouchableOpacity>
            <Text style={s.formTitle}>{editing ? 'Edit Rider' : 'Add Rider'}</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={s.tabBar}>
            {['Personal Info', 'Work Details'].map((t, i) => (
              <TouchableOpacity key={i} style={[s.tabBtn, tab === i && s.tabBtnActive]} onPress={() => setTab(i)}>
                <Text style={[s.tabBtnText, tab === i && s.tabBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={s.formBody} keyboardShouldPersistTaps="handled">
            {tab === 0 ? (
              <>
                <FL label="Full Name *" />
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Rider name" placeholderTextColor="#bbb" />
                <FL label="Phone *" />
                <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+91 9876543210" placeholderTextColor="#bbb" keyboardType="phone-pad" />
                <FL label="Email" />
                <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="rider@email.com" placeholderTextColor="#bbb" keyboardType="email-address" autoCapitalize="none" />
                <FL label={editing ? 'New Password (leave blank to keep)' : 'Password *'} />
                <TextInput style={s.input} value={pass} onChangeText={setPass} placeholder="Min 6 characters" placeholderTextColor="#bbb" secureTextEntry />
              </>
            ) : (
              <>
                <FL label="Vehicle Type" />
                <View style={s.vTypeRow}>
                  {VEHICLE_TYPES.map(vt => (
                    <TouchableOpacity key={vt} style={[s.vTypeBtn, vType === vt && s.vTypeBtnActive]} onPress={() => setVType(vt)}>
                      <Text style={[s.vTypeBtnText, vType === vt && s.vTypeBtnTextActive]}>{vt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <FL label="Vehicle Number" />
                <TextInput style={s.input} value={vNum} onChangeText={setVNum} placeholder="MH 01 AB 1234" placeholderTextColor="#bbb" autoCapitalize="characters" />
                <FL label="Delivery Fee" />
                <TextInput style={s.input} value={dFee} onChangeText={setDFee} placeholder="0.00" placeholderTextColor="#bbb" keyboardType="decimal-pad" />
                <FL label="Assign Zones" />
                {zones.length === 0
                  ? <Text style={s.hint}>No active zones. Create zones first.</Text>
                  : zones.map(z => {
                      const sel = selZones.some(s => String(s) === String(z.id));
                      return (
                        <TouchableOpacity key={String(z.id)} style={s.checkRow} onPress={() => toggleZone(z.id)}>
                          <View style={[s.checkbox, sel && s.checkboxSel]}>
                            {sel && <Ionicons name="checkmark" size={13} color="#fff" />}
                          </View>
                          <Text style={s.checkLabel}>{z.name}</Text>
                        </TouchableOpacity>
                      );
                    })
                }
              </>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={s.formFooter}>
            {tab === 0
              ? <TouchableOpacity style={s.nextBtn} onPress={() => setTab(1)}>
                  <Text style={s.nextBtnText}>Work Details →</Text>
                </TouchableOpacity>
              : <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.saveBtnText}>{editing ? 'Update Rider ✓' : 'Add Rider ✓'}</Text>
                  }
                </TouchableOpacity>
            }
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ── Screen ───────────────────────────────────────────────────────────────────
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Delivery Staff</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => { setEditing(null); setShowForm(true); }}>
          <MaterialIcons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={riders}
        keyExtractor={r => String(r.id)}
        renderItem={({ item }) => <RiderRow item={item} />}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={52} color="#ddd" />
            <Text style={s.emptyText}>No delivery staff yet</Text>
            <Text style={s.hint}>Tap + to add your first rider</Text>
          </View>
        }
      />

      <DetailModal />
      {showForm && <RiderFormModal />}
    </View>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

const FL = ({ label }: { label: string }) => <Text style={s.fieldLabel}>{label}</Text>;

const InfoRow = ({ icon, label, val, last }: { icon: any; label: string; val: string; last?: boolean }) => (
  <View style={[s.infoRow, last && { borderBottomWidth: 0 }]}>
    <Ionicons name={icon} size={15} color="#7c3aed" style={{ marginRight: 10 }} />
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoVal}>{val}</Text>
  </View>
);

const ActionRow = ({
  icon, iconBg, iconColor, label, labelColor, onPress, last,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; labelColor?: string; onPress: () => void; last?: boolean;
}) => (
  <TouchableOpacity style={[s.actionRow, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
    <View style={[s.actionIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={17} color={iconColor} />
    </View>
    <Text style={[s.actionLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#ccc" />
  </TouchableOpacity>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f7' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  addBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  // list
  row:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 },
  sep:         { height: 1, backgroundColor: '#f3f4f6', marginLeft: 76 },
  avatarWrap:  { position: 'relative', marginRight: 14 },
  avatar:      { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  avatarInitials:    { fontSize: 16, fontWeight: '800', color: '#7c3aed' },
  onlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  rowBody:     { flex: 1 },
  rowName:     { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  rowPhone:    { fontSize: 13, color: '#6b7280' },

  // detail bottom sheet
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  closeBtn:    { position: 'absolute', top: 16, right: 20, padding: 4, zIndex: 10 },

  detailHead:      { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  detailAvatarWrap:{ position: 'relative', marginRight: 14 },
  detailAvatar:    { width: 68, height: 68, borderRadius: 34 },
  detailAvatarPh:  { backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  detailInitials:  { fontSize: 22, fontWeight: '800', color: '#7c3aed' },
  onlineDotLg:     { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  detailName:      { fontSize: 19, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  detailMeta:      { flexDirection: 'row', gap: 8 },
  statusPill:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  pillGreen:       { backgroundColor: '#dcfce7' },
  pillRed:         { backgroundColor: '#fee2e2' },
  pillText:        { fontSize: 11, fontWeight: '700' },
  pillGreenText:   { color: '#16a34a' },
  pillRedText:     { color: '#dc2626' },
  onlinePill:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  onlineDotSm:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 4 },
  onlineLabel:     { fontSize: 11, fontWeight: '700', color: '#16a34a' },

  infoBox:   { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 13, color: '#9ca3af', width: 96 },
  infoVal:   { fontSize: 13, color: '#1a1a1a', fontWeight: '500', flex: 1 },

  zonesBox:   { marginBottom: 14 },
  zonesLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  zonePills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  zonePill:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ede9fe', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  zonePillText: { fontSize: 12, color: '#7c3aed', fontWeight: '600' },

  actionsBox:   { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden' },
  actionRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  actionIcon:   { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actionLabel:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },

  // form
  formHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  formTitle:       { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  tabBar:          { flexDirection: 'row', backgroundColor: '#fff', padding: 12, gap: 10 },
  tabBtn:          { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center' },
  tabBtnActive:    { backgroundColor: '#7c3aed' },
  tabBtnText:      { fontSize: 13, fontWeight: '600', color: '#555' },
  tabBtnTextActive:{ color: '#fff' },
  formBody:        { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  input:           { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a' },
  vTypeRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vTypeBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  vTypeBtnActive:  { backgroundColor: '#ede9fe', borderColor: '#7c3aed' },
  vTypeBtnText:    { fontSize: 13, color: '#555', fontWeight: '500' },
  vTypeBtnTextActive: { color: '#7c3aed', fontWeight: '700' },
  checkRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxSel:     { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  checkLabel:      { fontSize: 14, color: '#1a1a1a', flex: 1 },
  formFooter:      { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  nextBtn:         { backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  nextBtnText:     { fontSize: 15, fontWeight: '700', color: '#555' },
  saveBtn:         { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  emptyBox:  { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 12, marginBottom: 4 },
  hint:      { fontSize: 13, color: '#bbb', marginTop: 4 },
});
