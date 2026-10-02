import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { storeCreateOrder, storeGetProduct, storeNewOrderData } from '@/src/api/api';

const PRIMARY = COLORS.primary;
const DAYS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Cate        { id: number; name: string; }
interface Meal        { id: number; name: string; price: number; delivery_fee: number; duration_days: number; food_type: string; }
interface Prediction  { place_id: string; description: string; }

// ── Google Places Autocomplete ────────────────────────────────────────────────

function AddressAutocomplete({
  mapKey,
  value,
  onSelect,
  error,
}: {
  mapKey: string;
  value: string;
  onSelect: (address: string, lat: string, lng: string) => void;
  error?: string;
}) {
  const [query,       setQuery]       = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [showList,    setShowList]    = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (text: string) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (!text.trim() || text.length < 3) { setPredictions([]); setShowList(false); return; }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${mapKey}&language=en`;
        const res  = await fetch(url);
        const json = await res.json();
        if (json.status === 'OK') {
          setPredictions(json.predictions ?? []);
          setShowList(true);
        } else {
          setPredictions([]);
        }
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
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
      <View style={[styles.addressInputWrap, error && styles.inputErr]}>
        <MaterialIcons name="search" size={18} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.addressInput}
          placeholder="Search address…"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={search}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={PRIMARY} style={{ marginLeft: 6 }} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={() => { setQuery(''); setPredictions([]); setShowList(false); onSelect('', '', ''); }}>
            <MaterialIcons name="close" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {showList && predictions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {predictions.map(p => (
            <TouchableOpacity key={p.place_id} style={styles.suggestionRow} onPress={() => pick(p)}>
              <MaterialIcons name="place" size={14} color={PRIMARY} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.suggestionText} numberOfLines={2}>{p.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function Create() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  // Form fields
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [phone,        setPhone]        = useState('');
  const [country,      setCountry]      = useState('+91');
  const [address,      setAddress]      = useState('');
  const [lat,          setLat]          = useState('');
  const [lng,          setLng]          = useState('');
  const [houseNo,      setHouseNo]      = useState('');
  const [landmark,     setLandmark]     = useState('');
  const [selectedCate, setSelectedCate] = useState<Cate | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [qty,          setQty]          = useState('1');
  const [selectedDays, setSelectedDays] = useState<string[]>([...DAYS]);
  const [startFrom,    setStartFrom]    = useState('');
  const [discount,     setDiscount]     = useState('');

  // Loaded data
  const [cates,    setCates]    = useState<Cate[]>([]);
  const [meals,    setMeals]    = useState<Meal[]>([]);
  const [dates,    setDates]    = useState<string[]>([]);
  const [currency, setCurrency] = useState('₹');
  const [mapKey,   setMapKey]   = useState('');

  // UI state
  const [initLoading, setInitLoading] = useState(true);
  const [mealLoading, setMealLoading] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // Picker modals
  const [catePicker, setCatePicker] = useState(false);
  const [mealPicker, setMealPicker] = useState(false);
  const [datePicker, setDatePicker] = useState(false);
  const [qtyPicker,  setQtyPicker]  = useState(false);

  useEffect(() => {
    storeNewOrderData()
      .then(res => {
        setCates(res.data.cates ?? []);
        setDates(res.data.dates ?? []);
        setCurrency(res.data.currency ?? '₹');
        setMapKey(res.data.map_key ?? '');
      })
      .catch(() => Alert.alert('Error', 'Failed to load form data.'))
      .finally(() => setInitLoading(false));
  }, []);

  const onSelectCate = async (cate: Cate) => {
    setSelectedCate(cate);
    setSelectedMeal(null);
    setMeals([]);
    setCatePicker(false);
    setMealLoading(true);
    try {
      const res = await storeGetProduct(cate.name);
      setMeals(res.data ?? []);
    } catch {
      Alert.alert('Error', 'Failed to load meals.');
    } finally {
      setMealLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    if (errors.days) setErrors(p => ({ ...p, days: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())               e.name      = 'Required';
    if (!email.trim())              e.email     = 'Required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!phone.trim())              e.phone     = 'Required';
    if (!address.trim())            e.address   = 'Select an address from suggestions';
    if (!houseNo.trim())            e.houseNo   = 'Required';
    if (!selectedCate)              e.cate      = 'Select a category';
    if (!selectedMeal)              e.meal      = 'Select a meal';
    if (selectedDays.length === 0)  e.days      = 'Select at least one day';
    if (!startFrom)                 e.startFrom = 'Select start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await storeCreateOrder({
        name:       name.trim(),
        email:      email.trim().toLowerCase(),
        phone:      phone.trim(),
        country:    country.trim(),
        address:    address.trim(),
        house_no:   houseNo.trim(),
        landmark:   landmark.trim() || null,
        lat:        lat || null,
        lng:        lng || null,
        meal_type:  selectedCate!.name,
        item_id:    selectedMeal!.id,
        qty,
        days:       selectedDays,
        start_from: startFrom,
        discount:   discount.trim() || null,
      });
      if (res.msg === 'done') {
        Alert.alert('Success', 'Subscription created successfully!', [
          { text: 'View Subscriptions', onPress: () => router.push('/(tabs)/subscriptions' as any) },
          { text: 'Create Another',     onPress: resetForm },
        ]);
      } else {
        Alert.alert('Error', 'Failed to create subscription.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setCountry('+91');
    setAddress(''); setLat(''); setLng(''); setHouseNo(''); setLandmark('');
    setSelectedCate(null); setSelectedMeal(null); setMeals([]);
    setQty('1'); setSelectedDays([...DAYS]); setStartFrom(''); setDiscount('');
    setErrors({});
  };

  const clearErr = (k: string) => setErrors(p => ({ ...p, [k]: '' }));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });

  if (initLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Subscription</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Customer Info ──────────────────────────────────────────── */}
        <SectionHeader icon="person" title="Customer Information" />

        <Field label="Full Name" required error={errors.name}>
          <TextInput style={[styles.input, errors.name && styles.inputErr]}
            placeholder="Customer name" placeholderTextColor="#9ca3af"
            value={name} onChangeText={t => { setName(t); clearErr('name'); }} />
        </Field>

        <Field label="Email" required error={errors.email}>
          <TextInput style={[styles.input, errors.email && styles.inputErr]}
            placeholder="customer@example.com" placeholderTextColor="#9ca3af"
            value={email} onChangeText={t => { setEmail(t); clearErr('email'); }}
            keyboardType="email-address" autoCapitalize="none" />
        </Field>

        <View style={styles.row}>
          <Field label="Code" style={{ width: 84 }}>
            <TextInput style={styles.input} placeholder="+91" placeholderTextColor="#9ca3af"
              value={country} onChangeText={setCountry} keyboardType="phone-pad" />
          </Field>
          <Field label="Phone" required error={errors.phone} style={{ flex: 1 }}>
            <TextInput style={[styles.input, errors.phone && styles.inputErr]}
              placeholder="Phone number" placeholderTextColor="#9ca3af"
              value={phone} onChangeText={t => { setPhone(t); clearErr('phone'); }} keyboardType="phone-pad" />
          </Field>
        </View>

        {/* ── Delivery Address ──────────────────────────────────────── */}
        <SectionHeader icon="place" title="Delivery Address" />

        <Field label="Search Address" required error={errors.address}>
          {mapKey ? (
            <AddressAutocomplete
              mapKey={mapKey}
              value={address}
              error={errors.address}
              onSelect={(addr, lt, ln) => {
                setAddress(addr);
                setLat(lt);
                setLng(ln);
                if (addr) clearErr('address');
              }}
            />
          ) : (
            <TextInput style={[styles.input, errors.address && styles.inputErr]}
              placeholder="Enter address" placeholderTextColor="#9ca3af"
              value={address} onChangeText={t => { setAddress(t); clearErr('address'); }} />
          )}
        </Field>

        <View style={styles.row}>
          <Field label="House / Flat No." required error={errors.houseNo} style={{ flex: 1 }}>
            <TextInput style={[styles.input, errors.houseNo && styles.inputErr]}
              placeholder="A-101" placeholderTextColor="#9ca3af"
              value={houseNo} onChangeText={t => { setHouseNo(t); clearErr('houseNo'); }} />
          </Field>
          <Field label="Landmark" style={{ flex: 1 }}>
            <TextInput style={styles.input} placeholder="Optional" placeholderTextColor="#9ca3af"
              value={landmark} onChangeText={setLandmark} />
          </Field>
        </View>

        {/* ── Subscription Meal ─────────────────────────────────────── */}
        <SectionHeader icon="restaurant-menu" title="Subscription Meal" />

        <Field label="Category" required error={errors.cate}>
          <TouchableOpacity style={[styles.picker, errors.cate && styles.inputErr]} onPress={() => setCatePicker(true)}>
            <Text style={selectedCate ? styles.pickerValue : styles.pickerPlaceholder}>
              {selectedCate?.name ?? 'Select category'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </Field>

        <Field label="Meal" required error={errors.meal}>
          <TouchableOpacity
            style={[styles.picker, errors.meal && styles.inputErr, !selectedCate && styles.pickerDisabled]}
            onPress={() => selectedCate && setMealPicker(true)}
            disabled={!selectedCate}
          >
            {mealLoading
              ? <ActivityIndicator size="small" color={PRIMARY} />
              : <>
                  <Text style={selectedMeal ? styles.pickerValue : styles.pickerPlaceholder} numberOfLines={1}>
                    {selectedMeal ? `${selectedMeal.name} (${selectedMeal.food_type})` : 'Select meal'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#9ca3af" />
                </>}
          </TouchableOpacity>
        </Field>

        {selectedMeal && (
          <View style={styles.mealPreview}>
            <PreviewRow icon="monetization-on" label="Price"    value={`${currency}${selectedMeal.price}`} />
            <PreviewRow icon="local-shipping"  label="Delivery" value={`${currency}${selectedMeal.delivery_fee}`} />
            <PreviewRow icon="date-range"      label="Duration" value={`${selectedMeal.duration_days} days`} />
          </View>
        )}

        <Field label="Quantity" required>
          <TouchableOpacity style={styles.picker} onPress={() => setQtyPicker(true)}>
            <Text style={styles.pickerValue}>{qty}</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </Field>

        <Field label="Delivery Days" required error={errors.days}>
          <View style={styles.daysRow}>
            {DAYS.map(day => {
              const active = selectedDays.includes(day);
              return (
                <TouchableOpacity key={day}
                  style={[styles.dayBtn, active && styles.dayBtnActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Starting Date" required error={errors.startFrom}>
          <TouchableOpacity style={[styles.picker, errors.startFrom && styles.inputErr]} onPress={() => setDatePicker(true)}>
            <Text style={startFrom ? styles.pickerValue : styles.pickerPlaceholder}>
              {startFrom ? formatDate(startFrom) : 'Select start date'}
            </Text>
            <MaterialIcons name="calendar-today" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </Field>

        <Field label="Discount (optional)">
          <TextInput style={styles.input}
            placeholder={`Amount e.g. ${currency}50`} placeholderTextColor="#9ca3af"
            value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" />
        </Field>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit} disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <MaterialIcons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>Create Subscription</Text>
              </>}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Category Picker ───────────────────────────────────────────── */}
      <PickerModal visible={catePicker} title="Select Category" onClose={() => setCatePicker(false)}
        empty={cates.length === 0 ? 'No categories found.' : ''}>
        {cates.map(c => (
          <TouchableOpacity key={c.id} style={styles.pickerItem} onPress={() => onSelectCate(c)}>
            <Text style={styles.pickerItemText}>{c.name}</Text>
            {selectedCate?.id === c.id && <MaterialIcons name="check" size={18} color={PRIMARY} />}
          </TouchableOpacity>
        ))}
      </PickerModal>

      {/* ── Meal Picker ───────────────────────────────────────────────── */}
      <PickerModal visible={mealPicker} title="Select Meal" onClose={() => setMealPicker(false)}
        empty={meals.length === 0 ? 'No active meals in this category.' : ''}>
        {meals.map(m => (
          <TouchableOpacity key={m.id} style={styles.pickerItem}
            onPress={() => { setSelectedMeal(m); setMealPicker(false); clearErr('meal'); }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerItemText}>{m.name}</Text>
              <Text style={styles.pickerItemSub}>{m.food_type} • {currency}{m.price} • {m.duration_days} days</Text>
            </View>
            {selectedMeal?.id === m.id && <MaterialIcons name="check" size={18} color={PRIMARY} />}
          </TouchableOpacity>
        ))}
      </PickerModal>

      {/* ── Date Picker ───────────────────────────────────────────────── */}
      <PickerModal visible={datePicker} title="Select Start Date" onClose={() => setDatePicker(false)}
        empty={dates.length === 0 ? 'No available dates.' : ''}>
        {dates.map(d => (
          <TouchableOpacity key={d} style={styles.pickerItem}
            onPress={() => { setStartFrom(d); setDatePicker(false); clearErr('startFrom'); }}>
            <Text style={styles.pickerItemText}>{formatDate(d)}</Text>
            {startFrom === d && <MaterialIcons name="check" size={18} color={PRIMARY} />}
          </TouchableOpacity>
        ))}
      </PickerModal>

      {/* ── Qty Picker ────────────────────────────────────────────────── */}
      <PickerModal visible={qtyPicker} title="Select Quantity" onClose={() => setQtyPicker(false)}>
        {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(q => (
          <TouchableOpacity key={q} style={styles.pickerItem} onPress={() => { setQty(q); setQtyPicker(false); }}>
            <Text style={styles.pickerItemText}>{q}</Text>
            {qty === q && <MaterialIcons name="check" size={18} color={PRIMARY} />}
          </TouchableOpacity>
        ))}
      </PickerModal>
    </KeyboardAvoidingView>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBg}>
        <MaterialIcons name={icon} size={16} color={PRIMARY} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, required, error, children, style }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.req}> *</Text>}
      </Text>
      {children}
      {!!error && <Text style={styles.errText}>{error}</Text>}
    </View>
  );
}

function PreviewRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.mealPreviewRow}>
      <MaterialIcons name={icon} size={13} color={PRIMARY} />
      <Text style={styles.mealPreviewText}>{label}: <Text style={styles.mealPreviewBold}>{value}</Text></Text>
    </View>
  );
}

function PickerModal({ visible, title, onClose, children, empty }: {
  visible: boolean; title: string; onClose: () => void; children?: React.ReactNode; empty?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
          {empty ? (
            <View style={styles.emptyWrap}>
              <MaterialIcons name="inbox" size={36} color="#cbd5e1" />
              <Text style={styles.emptyText}>{empty}</Text>
            </View>
          ) : children}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },

  scroll: { padding: 16 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 14 },
  sectionIconBg: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center' },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: '#0f172a' },

  // Form
  row:   { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  req:   { color: '#ef4444' },

  input:    { height: 48, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: COLORS.border },
  inputErr: { borderColor: '#ef4444', borderWidth: 1.5 },
  errText:  { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 2 },

  // Address autocomplete
  addressInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, height: 48 },
  addressInput:     { flex: 1, fontSize: 14, color: '#0f172a' },
  suggestionsBox:   { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 4, overflow: 'hidden', zIndex: 99 },
  suggestionRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestionText:   { flex: 1, fontSize: 13, color: '#0f172a', lineHeight: 18 },

  // Picker trigger
  picker:            { height: 48, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerDisabled:    { opacity: 0.45 },
  pickerValue:       { fontSize: 14, color: '#0f172a', flex: 1 },
  pickerPlaceholder: { fontSize: 14, color: '#9ca3af', flex: 1 },

  // Meal preview
  mealPreview:     { backgroundColor: '#f0ebff', borderRadius: 12, padding: 12, marginBottom: 12, gap: 5 },
  mealPreviewRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealPreviewText: { fontSize: 13, color: '#334155' },
  mealPreviewBold: { fontWeight: '700', color: PRIMARY },

  // Days
  daysRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayBtn:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  dayBtnActive:  { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dayText:       { fontSize: 12, fontWeight: '700', color: '#64748b' },
  dayTextActive: { color: '#fff' },

  // Submit
  submitBtn:         { flexDirection: 'row', height: 52, backgroundColor: PRIMARY, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  submitText:        { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Picker modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 14 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#0f172a' },

  pickerItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { flex: 1, fontSize: 15, color: '#0f172a', fontWeight: '600' },
  pickerItemSub:  { fontSize: 12, color: '#64748b', marginTop: 2 },

  emptyWrap: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 10, textAlign: 'center' },
});
