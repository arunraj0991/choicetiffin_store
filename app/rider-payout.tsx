import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  storeRiderPayout, storeRiderApprovePayout, storeRiderDeclinePayout,
} from '../src/api/api';

type Overview = {
  rider:   { name: string; phone: string };
  earning: number;
  paid:    number;
  balance: number;
};
type PayoutReq = { id: number; rider_id: string; amount: number; status: number; created_at: string } | null;
type PayoutItem = { id: number; rider_id: string; amount: number; status: number; notes: string | null; status_date: string | null; created_at: string };

const STATUS_LABEL: Record<number, string> = { 0: 'Pending', 1: 'Approved', 2: 'Declined' };
const STATUS_COLOR: Record<number, { bg: string; text: string }> = {
  0: { bg: '#fef9c3', text: '#92400e' },
  1: { bg: '#dcfce7', text: '#16a34a' },
  2: { bg: '#fee2e2', text: '#dc2626' },
};

export default function RiderPayoutScreen() {
  const headerPad = useSafeHeaderPad();
  const router   = useRouter();
  const { rider_id, rider_name } = useLocalSearchParams<{ rider_id: string; rider_name: string }>();

  const [loading,   setLoading]   = useState(true);
  const [overview,  setOverview]  = useState<Overview | null>(null);
  const [req,       setReq]       = useState<PayoutReq>(null);
  const [list,      setList]      = useState<PayoutItem[]>([]);
  const [declining, setDeclining] = useState(false);
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await storeRiderPayout(rider_id);
      const d   = res.data;
      setOverview(d.data);
      setReq(d.req || null);
      setList(d.list || []);
    } catch {
      Alert.alert('Error', 'Failed to load payout data.');
    } finally {
      setLoading(false);
    }
  }, [rider_id]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!req) return;
    Alert.alert('Approve Payout', `Approve payment of ${req.amount} to ${rider_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', onPress: async () => {
          setSaving(true);
          try {
            await storeRiderApprovePayout(req.id, req.rider_id);
            load();
          } catch {
            Alert.alert('Error', 'Failed to approve payout.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const decline = async () => {
    if (!req || !notes.trim()) {
      Alert.alert('Validation', 'Please enter a reason for declining.');
      return;
    }
    setSaving(true);
    try {
      await storeRiderDeclinePayout(req.id, req.rider_id, notes.trim());
      setDeclining(false);
      setNotes('');
      load();
    } catch {
      Alert.alert('Error', 'Failed to decline payout.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Earning & Payout</Text>
          <Text style={s.headerSub}>{decodeURIComponent(rider_name || '')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* ── Overview cards ── */}
        {overview && (
          <View style={s.statsRow}>
            <StatCard label="Total Earned" value={overview.earning} color="#7c3aed" />
            <StatCard label="Total Paid"   value={overview.paid}    color="#16a34a" />
            <StatCard label="Balance"      value={overview.balance} color={overview.balance > 0 ? '#f59e0b' : '#6b7280'} />
          </View>
        )}

        {/* ── Pending payout request ── */}
        {req && (
          <View style={s.reqBox}>
            <View style={s.reqHeader}>
              <Ionicons name="time-outline" size={18} color="#f59e0b" />
              <Text style={s.reqTitle}>Pending Payout Request</Text>
            </View>
            <Text style={s.reqAmount}>{req.amount}</Text>
            <Text style={s.reqDate}>Requested on {new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            <View style={s.reqBtns}>
              <TouchableOpacity style={[s.reqBtn, s.reqBtnApprove]} onPress={approve} disabled={saving}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={s.reqBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.reqBtn, s.reqBtnDecline]} onPress={() => setDeclining(true)} disabled={saving}>
                <Ionicons name="close-circle-outline" size={16} color="#fff" />
                <Text style={s.reqBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Payout history ── */}
        <Text style={s.sectionTitle}>Payout History</Text>
        {list.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="receipt-outline" size={40} color="#ddd" />
            <Text style={s.emptyText}>No payouts yet</Text>
          </View>
        ) : (
          list.map(item => {
            const sc = STATUS_COLOR[item.status] || STATUS_COLOR[0];
            return (
              <View key={item.id} style={s.payoutCard}>
                <View style={s.payoutLeft}>
                  <Text style={s.payoutAmount}>{item.amount}</Text>
                  <Text style={s.payoutDate}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  {item.notes ? <Text style={s.payoutNotes}>{item.notes}</Text> : null}
                </View>
                <View>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusBadgeText, { color: sc.text }]}>{STATUS_LABEL[item.status]}</Text>
                  </View>
                  {item.status_date ? <Text style={s.payoutStatusDate}>{item.status_date}</Text> : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Decline modal ── */}
      <Modal visible={declining} transparent animationType="fade" onRequestClose={() => setDeclining(false)}>
        <View style={s.dialogOverlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>Decline Payout</Text>
            <Text style={s.dialogSub}>Provide a reason for declining this request.</Text>
            <TextInput
              style={s.dialogInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Reason..."
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={3}
            />
            <View style={s.dialogBtns}>
              <TouchableOpacity style={s.dialogCancel} onPress={() => { setDeclining(false); setNotes(''); }}>
                <Text style={s.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.dialogDecline, saving && { opacity: 0.6 }]} onPress={decline} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.dialogDeclineText}>Decline</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={s.statCard}>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f5f5f7' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 12 },
  backBtn:    { marginRight: 4 },
  headerTitle:{ fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerSub:  { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  statsRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:   { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statValue:  { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel:  { fontSize: 11, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },

  reqBox:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#f59e0b', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  reqHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reqTitle:   { fontSize: 14, fontWeight: '700', color: '#92400e' },
  reqAmount:  { fontSize: 28, fontWeight: '900', color: '#1a1a1a', marginBottom: 4 },
  reqDate:    { fontSize: 12, color: '#9ca3af', marginBottom: 14 },
  reqBtns:    { flexDirection: 'row', gap: 10 },
  reqBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  reqBtnApprove: { backgroundColor: '#16a34a' },
  reqBtnDecline: { backgroundColor: '#ef4444' },
  reqBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 },

  payoutCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  payoutLeft:   { flex: 1, marginRight: 12 },
  payoutAmount: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 3 },
  payoutDate:   { fontSize: 12, color: '#9ca3af' },
  payoutNotes:  { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  payoutStatusDate: { fontSize: 11, color: '#bbb', marginTop: 4, textAlign: 'right' },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  emptyBox:   { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: '#bbb', marginTop: 10 },

  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%' },
  dialogTitle:   { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  dialogSub:     { fontSize: 13, color: '#6b7280', marginBottom: 14 },
  dialogInput:   { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', minHeight: 80, textAlignVertical: 'top' },
  dialogBtns:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  dialogCancel:  { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center' },
  dialogCancelText: { fontWeight: '700', color: '#555' },
  dialogDecline: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center' },
  dialogDeclineText: { fontWeight: '700', color: '#fff' },
});
