import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
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
import {
  storeCateDelete,
  storeCates,
  storeCateStatus,
  storeCateStore,
  storeCateUpdate,
} from '@/src/api/api';

const PRIMARY = COLORS.primary;

interface Cate {
  id:       number | string;
  name:     string;
  sort_no:  number;
  d_time:   string | null;
  status:   number;
}

const emptyForm = { name: '', sort_no: '1', d_time: '' };

// ── Form Modal ────────────────────────────────────────────────────────────────

function CateFormModal({ visible, editing, onClose, onSaved }: {
  visible: boolean;
  editing: Cate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,    setName]    = useState('');
  const [sortNo,  setSortNo]  = useState('1');
  const [dTime,   setDTime]   = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '');
      setSortNo(editing?.sort_no != null ? String(editing.sort_no) : '1');
      setDTime(editing?.d_time ?? '');
    }
  }, [visible, editing]);

  const submit = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Category name is required.'); return; }
    if (!sortNo.trim()) { Alert.alert('Error', 'Sort number is required.'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), sort_no: sortNo, d_time: dTime.trim() };
      if (editing) {
        await storeCateUpdate(editing.id, payload);
      } else {
        await storeCateStore(payload);
      }
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
            <Text style={s.sheetTitle}>{editing ? 'Edit Category' : 'Add Category'}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={s.field}>
              <Text style={s.label}>Category Name *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Breakfast"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Sort No */}
            <View style={s.field}>
              <Text style={s.label}>Sort No *</Text>
              <TextInput
                style={s.input}
                value={sortNo}
                onChangeText={setSortNo}
                placeholder="1"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
            </View>

            {/* Delivery Time */}
            <View style={s.field}>
              <Text style={s.label}>Delivery Time</Text>
              <TextInput
                style={s.input}
                value={dTime}
                onChangeText={setDTime}
                placeholder="e.g. Delivery Between 8:00 AM to 9:00 AM"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <><MaterialIcons name="check" size={18} color="#fff" /><Text style={s.submitBtnText}>{editing ? 'Update' : 'Add Category'}</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ManageCategory() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [cates,      setCates]      = useState<Cate[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Cate | null>(null);
  const [actionFor,  setActionFor]  = useState<Cate | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await storeCates();
      setCates(res.data ?? []);
    } catch {
      Alert.alert('Error', 'Failed to load categories.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openAdd  = () => { setEditing(null); setShowForm(true); };
  const openEdit = (c: Cate) => { setActionFor(null); setEditing(c); setShowForm(true); };

  const toggleStatus = async (c: Cate) => {
    setActionFor(null);
    try {
      await storeCateStatus(c.id);
      setCates(prev => prev.map(x => x.id === c.id ? { ...x, status: x.status === 0 ? 1 : 0 } : x));
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const confirmDelete = (c: Cate) => {
    setActionFor(null);
    Alert.alert(
      'Delete Category',
      `Delete "${c.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await storeCateDelete(c.id);
              setCates(prev => prev.filter(x => x.id !== c.id));
            } catch {
              Alert.alert('Error', 'Failed to delete. It may be in use.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Manage Category</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <MaterialIcons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
        >
          {cates.length === 0 && (
            <View style={s.empty}>
              <MaterialIcons name="category" size={52} color="#cbd5e1" />
              <Text style={s.emptyTitle}>No categories yet</Text>
              <Text style={s.emptySub}>Tap the + button to add your first category</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
                <MaterialIcons name="add" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add Category</Text>
              </TouchableOpacity>
            </View>
          )}

          {cates.map(c => (
            <View key={c.id} style={s.card}>
              {/* Sort badge */}
              <View style={s.sortBadge}>
                <Text style={s.sortText}>#{c.sort_no}</Text>
              </View>

              {/* Info */}
              <View style={s.cardBody}>
                <View style={s.cardTop}>
                  <Text style={s.cateName}>{c.name}</Text>
                  <TouchableOpacity
                    style={[s.statusBadge, c.status === 0 ? s.statusActive : s.statusDisabled]}
                    onPress={() => toggleStatus(c)}
                  >
                    <Text style={[s.statusText, { color: c.status === 0 ? '#16a34a' : '#94a3b8' }]}>
                      {c.status === 0 ? 'Active' : 'Disabled'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {c.d_time ? (
                  <View style={s.dtimeRow}>
                    <MaterialIcons name="schedule" size={13} color="#94a3b8" />
                    <Text style={s.dtimeText}>{c.d_time}</Text>
                  </View>
                ) : null}
              </View>

              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(c)}>
                  <MaterialIcons name="edit" size={18} color={PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#fef2f2' }]} onPress={() => confirmDelete(c)}>
                  <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Form modal */}
      <CateFormModal
        visible={showForm}
        editing={editing}
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

  // Header
  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  addBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  // List
  list: { padding: 14, gap: 10, paddingBottom: 40 },

  // Card
  card:        { backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sortBadge:   { width: 38, height: 38, borderRadius: 12, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center' },
  sortText:    { fontSize: 12, fontWeight: '800', color: PRIMARY },
  cardBody:    { flex: 1 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cateName:    { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusActive:{ backgroundColor: '#dcfce7' },
  statusDisabled:{ backgroundColor: '#f1f5f9' },
  statusText:  { fontSize: 11, fontWeight: '700' },
  dtimeRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dtimeText:   { fontSize: 12, color: '#64748b', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0ebff', justifyContent: 'center', alignItems: 'center' },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 80 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  emptySub:    { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 24 },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // Sheet
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 17, fontWeight: '800', color: '#0f172a' },

  // Form
  field:     { marginBottom: 16 },
  label:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:     { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0f172a' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
