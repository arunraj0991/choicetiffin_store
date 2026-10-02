import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { storeProfile, storeUpdateProfile } from '@/src/api/api';

const PRIMARY = COLORS.primary;

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type TabKey = 'basic' | 'mealtype' | 'days' | 'password' | 'other';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'basic',    label: 'Basic Info',   icon: 'person' },
  // { key: 'mealtype', label: 'Meal Type',    icon: 'restaurant' },
  { key: 'days',     label: 'Working Days', icon: 'event' },
  { key: 'password', label: 'Password',     icon: 'lock' },
  { key: 'other',    label: 'Other Info',   icon: 'info' },
];

interface AllCate { id: number | string; name: string; }

interface Profile {
  name: string; owner_name: string; email: string; phone: string; whatsapp_no: string;
  food_type: string; working_days: string[]; avg_cost: string; reg_no: string; fsi_no: string;
  cate_ids: (string | number)[]; store_types: string[]; all_cates: AllCate[];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {hint && <Text style={s.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

function TInput(props: React.ComponentProps<typeof TextInput> & { secure?: boolean }) {
  const [show, setShow] = useState(false);
  const { secure, style, ...rest } = props;
  return (
    <View style={s.inputWrap}>
      <TextInput style={[s.input, style]} secureTextEntry={secure && !show} placeholderTextColor="#94a3b8" {...rest} />
      {secure && (
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShow(p => !p)}>
          <MaterialIcons name={show ? 'visibility-off' : 'visibility'} size={20} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SaveBtn({ onPress, saving }: { onPress: () => void; saving: boolean }) {
  return (
    <TouchableOpacity style={s.saveBtn} onPress={onPress} disabled={saving}>
      {saving
        ? <ActivityIndicator color="#fff" size="small" />
        : <><MaterialIcons name="check" size={18} color="#fff" /><Text style={s.saveBtnText}>Save Changes</Text></>}
    </TouchableOpacity>
  );
}

export default function BusinessSettings() {
  const headerPad = useSafeHeaderPad();
  const router   = useRouter();
  const params   = useLocalSearchParams<{ tab?: string }>();
  const tabRef   = useRef<ScrollView>(null);

  const initialTab: TabKey = TABS.some(t => t.key === params.tab) ? (params.tab as TabKey) : 'basic';

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState<TabKey>(initialTab);

  const [storeTypes,     setStoreTypes]     = useState<string[]>([]);
  const [allCates,       setAllCates]       = useState<AllCate[]>([]);
  const [name,           setName]           = useState('');
  const [ownerName,      setOwnerName]      = useState('');
  const [email,          setEmail]          = useState('');
  const [phone,          setPhone]          = useState('');
  const [whatsapp,       setWhatsapp]       = useState('');
  const [foodType,       setFoodType]       = useState('');
  const [cateIds,        setCateIds]        = useState<(string | number)[]>([]);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [workDays,       setWorkDays]       = useState<string[]>([]);
  const [newPass,        setNewPass]        = useState('');
  const [confPass,       setConfPass]       = useState('');
  const [avgCost,        setAvgCost]        = useState('');
  const [regNo,          setRegNo]          = useState('');
  const [fsiNo,          setFsiNo]          = useState('');

  const load = useCallback(async () => {
    try {
      const res = await storeProfile();
      const d   = res.data as Profile;
      setStoreTypes(d.store_types ?? []);
      setAllCates(d.all_cates ?? []);
      setName(d.name ?? '');
      setOwnerName(d.owner_name ?? '');
      setEmail(d.email ?? '');
      setPhone(d.phone ?? '');
      setWhatsapp(d.whatsapp_no ?? '');
      setFoodType(d.food_type ?? '');
      setCateIds(d.cate_ids ?? []);
      setWorkDays(d.working_days ?? []);
      setAvgCost(d.avg_cost ?? '');
      setRegNo(d.reg_no ?? '');
      setFsiNo(d.fsi_no ?? '');
    } catch {
      Alert.alert('Error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!params.tab || !TABS.some(t => t.key === params.tab)) return;
    const key = params.tab as TabKey;
    const i = TABS.findIndex(t => t.key === key);
    setTab(key);
    setTimeout(() => tabRef.current?.scrollTo({ x: Math.max(0, i) * 100, animated: true }), 100);
  }, [params.tab]);

  const save = async (payload: object) => {
    setSaving(true);
    try {
      const res = await storeUpdateProfile(payload);
      if (res.msg === 'done') Alert.alert('Saved', 'Changes saved successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveBasic    = () => save({ name, owner_name: ownerName, email, phone, whatsapp_no: whatsapp });
  const saveMealType = () => save({ food_type: foodType, cate_id: cateIds });
  const saveDays     = () => save({ days: workDays });
  const saveOther    = () => save({ avg_cost: avgCost, reg_no: regNo, fsi_no: fsiNo });

  const savePassword = () => {
    if (!newPass)            { Alert.alert('Error', 'Enter a new password.'); return; }
    if (newPass.length < 6)  { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    if (newPass !== confPass) { Alert.alert('Error', 'Passwords do not match.'); return; }
    save({ password: newPass });
    setNewPass(''); setConfPass('');
  };

  const toggleDay  = (d: string) => setWorkDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleCate = (id: string | number) => setCateIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const switchTab = (key: TabKey, i: number) => {
    setTab(key);
    tabRef.current?.scrollTo({ x: i * 100, animated: true });
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Business Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.tabWrap}>
        <ScrollView ref={tabRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => switchTab(t.key, i)}>
              <MaterialIcons name={t.icon as any} size={14} color={tab === t.key ? PRIMARY : '#9ca3af'} />
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.card}>

            {tab === 'basic' && (
              <>
                <Text style={s.cardTitle}>Basic Information</Text>
                <Field label="Business Name *"><TInput value={name} onChangeText={setName} placeholder="e.g. Sai Tiffin" /></Field>
                <Field label="Owner Name *"><TInput value={ownerName} onChangeText={setOwnerName} placeholder="Full name" /></Field>
                <Field label="Email *"><TInput value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
                <Field label="Phone *"><TInput value={phone} onChangeText={setPhone} placeholder="+91 9999999999" keyboardType="phone-pad" /></Field>
                <Field label="WhatsApp Number"><TInput value={whatsapp} onChangeText={setWhatsapp} placeholder="+91 9999999999" keyboardType="phone-pad" /></Field>
                <SaveBtn onPress={saveBasic} saving={saving} />
              </>
            )}

            {tab === 'mealtype' && (
              <>
                <Text style={s.cardTitle}>Meal Type</Text>
                <Field label="Food Type *">
                  <TouchableOpacity style={s.pickerBtn} onPress={() => setShowFoodPicker(p => !p)}>
                    <Text style={[s.pickerTxt, !foodType && { color: '#94a3b8' }]}>{foodType || 'Select food type'}</Text>
                    <MaterialIcons name={showFoodPicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#94a3b8" />
                  </TouchableOpacity>
                  {showFoodPicker && (
                    <View style={s.dropdown}>
                      {storeTypes.map(t => (
                        <TouchableOpacity key={t} style={[s.dropRow, foodType === t && s.dropRowActive]} onPress={() => { setFoodType(t); setShowFoodPicker(false); }}>
                          <Text style={[s.dropTxt, foodType === t && { color: PRIMARY, fontWeight: '700' }]}>{t}</Text>
                          {foodType === t && <MaterialIcons name="check" size={16} color={PRIMARY} />}
                        </TouchableOpacity>
                      ))}
                      {storeTypes.length === 0 && <Text style={[s.dropTxt, { padding: 14, color: '#94a3b8' }]}>No types configured in admin settings</Text>}
                    </View>
                  )}
                </Field>
                <Field label="Meal Categories" hint="Select the food categories your store offers">
                  <View style={s.cateGrid}>
                    {allCates.map(c => {
                      const sel = cateIds.includes(c.id);
                      return (
                        <TouchableOpacity key={c.id} style={[s.cateItem, sel && s.cateItemOn]} onPress={() => toggleCate(c.id)}>
                          <View style={[s.chk, sel && s.chkOn]}>{sel && <MaterialIcons name="check" size={11} color="#fff" />}</View>
                          <Text style={[s.cateTxt, sel && { color: PRIMARY }]}>{c.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {allCates.length === 0 && <Text style={{ color: '#94a3b8', fontSize: 13 }}>No categories found</Text>}
                  </View>
                </Field>
                <SaveBtn onPress={saveMealType} saving={saving} />
              </>
            )}

            {tab === 'days' && (
              <>
                <Text style={s.cardTitle}>Working Days</Text>
                <Text style={s.subTxt}>Select the days your store is open for delivery</Text>
                <View style={s.daysRow}>
                  {ALL_DAYS.map(d => {
                    const on = workDays.includes(d);
                    return (
                      <TouchableOpacity key={d} style={[s.dayBtn, on && s.dayBtnOn]} onPress={() => toggleDay(d)}>
                        <Text style={[s.dayTxt, on && s.dayTxtOn]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.infoBox}>
                  <MaterialIcons name="info-outline" size={14} color={PRIMARY} />
                  <Text style={s.infoTxt}>These days control available dates when creating new subscriptions.</Text>
                </View>
                <SaveBtn onPress={saveDays} saving={saving} />
              </>
            )}

            {tab === 'password' && (
              <>
                <Text style={s.cardTitle}>Change Password</Text>
                <Field label="New Password"><TInput value={newPass} onChangeText={setNewPass} placeholder="Min 6 characters" secure /></Field>
                <Field label="Confirm Password"><TInput value={confPass} onChangeText={setConfPass} placeholder="Re-enter password" secure /></Field>
                <SaveBtn onPress={savePassword} saving={saving} />
              </>
            )}

            {tab === 'other' && (
              <>
                <Text style={s.cardTitle}>Other Information</Text>
                <Field label="Average Food Cost"><TInput value={avgCost} onChangeText={setAvgCost} placeholder="e.g. 70-100" /></Field>
                <Field label="Registration Number"><TInput value={regNo} onChangeText={setRegNo} placeholder="Business registration number" /></Field>
                <Field label="FSSAI / Licence Number"><TInput value={fsiNo} onChangeText={setFsiNo} placeholder="Food licence number" /></Field>
                <SaveBtn onPress={saveOther} saving={saving} />
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.secondary },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  tabWrap:      { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBar:       { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row' },
  tabBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  tabBtnActive: { backgroundColor: '#f0ebff', borderColor: PRIMARY },
  tabText:      { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  tabTextActive:{ color: PRIMARY },
  content:   { padding: 16, paddingBottom: 40 },
  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  subTxt:    { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: -12 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  hint:  { fontSize: 12, color: '#94a3b8', marginBottom: 8, marginTop: -2 },
  inputWrap: { position: 'relative' },
  input:     { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0f172a' },
  eyeBtn:    { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  pickerBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickerTxt:    { fontSize: 14, color: '#0f172a', flex: 1 },
  dropdown:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  dropRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropRowActive:{ backgroundColor: '#f0ebff' },
  dropTxt:      { fontSize: 14, color: '#0f172a', flex: 1 },
  cateGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cateItem:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  cateItemOn:  { backgroundColor: '#f0ebff', borderColor: PRIMARY },
  chk:         { width: 17, height: 17, borderRadius: 4, borderWidth: 1.5, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  chkOn:       { backgroundColor: PRIMARY, borderColor: PRIMARY },
  cateTxt:     { fontSize: 13, fontWeight: '600', color: '#374151' },
  daysRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  dayBtn:    { width: 48, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  dayBtnOn:  { backgroundColor: '#f0ebff', borderColor: PRIMARY },
  dayTxt:    { fontSize: 12, fontWeight: '700', color: '#64748b' },
  dayTxtOn:  { color: PRIMARY },
  infoBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0ebff', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoTxt:  { fontSize: 12, color: PRIMARY, flex: 1, lineHeight: 18 },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
