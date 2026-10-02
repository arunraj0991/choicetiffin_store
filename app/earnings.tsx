import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { storeEarning, storeGetBankDetail, storePayoutHistory, storePayoutRequest } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

type Summary = {
  total_earning: number;
  total_paid: number;
  weekly_earning: number;
  weekly_paid: number;
  weekly_delivery_earning: number;
  weekly_penalties: number;
  weekly_incentives: number;
  weekly_delivered_orders: number;
  week_start_date: string;
  week_end_date: string;
};
type Earning = { total: number; paid: number; balance: number };
type PayoutItem = {
  id?: number | string;
  payout_id?: number | string;
  store_id?: string | number;
  bank_id?: number | string;
  amount: number | string;
  status: number | string;
  notes?: string | null;
  status_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  account_holder_name?: string | null;
  branch_name?: string | null;
  upi_id?: string | null;
  status_text?: string | null;
};
type PayoutReq = PayoutItem | null;
type BankDetail = {
  id: number;
  store_id?: number | string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name?: string;
  upi_id?: string;
};

function resolveStatus(status?: number | string | null, statusText?: string | null) {
  const sNum = Number(status);
  const sStr = String(statusText || '').toLowerCase();

  if (sNum === 1 || sStr.includes('approved') || sStr.includes('paid')) {
    return {
      label: statusText || 'Approved / Paid',
      bg: '#dcfce7',
      text: '#16a34a',
      icon: 'checkmark-circle-outline' as const,
    };
  }
  if (sNum === 2 || sStr.includes('declined') || sStr.includes('rejected')) {
    return {
      label: statusText || 'Declined',
      bg: '#fee2e2',
      text: '#dc2626',
      icon: 'close-circle-outline' as const,
    };
  }
  return {
    label: statusText || 'Pending',
    bg: '#fef9c3',
    text: '#92400e',
    icon: 'time-outline' as const,
  };
}

function maskAccount(num?: string) {
  const n = String(num || '');
  if (n.length <= 4) return n;
  return `•••• ${n.slice(-4)}`;
}

function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDay(raw?: string | null) {
  if (!raw || raw === 'All Time') return raw || '—';
  const iso = String(raw).replace(' ', 'T');
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parsePayoutHistory(res: any): PayoutItem[] {
  const raw =
    res?.data?.data
    ?? res?.data
    ?? res?.list
    ?? res;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw.payout_id != null || raw.id != null || raw.amount != null)) {
    return [raw];
  }
  return [];
}

function parseSummary(res: any): Summary | null {
  const raw = res?.summary;
  if (!raw || typeof raw !== 'object') return null;
  const totalEarning = Number(raw.total_earning ?? 0);
  const totalPaid = Number(raw.total_paid ?? 0);
  return {
    total_earning: totalEarning,
    total_paid: totalPaid,
    weekly_earning: Number(raw.weekly_earning ?? 0),
    weekly_paid: Number(raw.weekly_paid ?? 0),
    weekly_delivery_earning: Number(raw.weekly_delivery_earning ?? 0),
    weekly_penalties: Number(raw.weekly_penalties ?? 0),
    weekly_incentives: Number(raw.weekly_incentives ?? 0),
    weekly_delivered_orders: Number(raw.weekly_delivered_orders ?? 0),
    week_start_date: String(raw.week_start_date ?? ''),
    week_end_date: String(raw.week_end_date ?? ''),
  };
}

/** Available for payout = total_earning − total_paid (never negative). */
function availableBalance(summary: Summary | null, legacy?: Earning | null) {
  if (legacy && Number.isFinite(legacy.balance)) return Math.max(0, Number(legacy.balance));
  if (!summary) return 0;
  return Math.max(0, Number(summary.total_earning) - Number(summary.total_paid));
}

function parseBanks(res: any): BankDetail[] {
  const raw =
    res?.data?.bank_details
    ?? res?.bank_details
    ?? res?.data
    ?? res?.list
    ?? res;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw.id != null || raw.account_number)) return [raw];
  return [];
}

export default function EarningsScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [earning,     setEarning]     = useState<Earning | null>(null);
  const [req,         setReq]         = useState<PayoutReq>(null);
  const [list,        setList]        = useState<PayoutItem[]>([]);
  const [currency,    setCurrency]    = useState('₹');
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [requesting,  setRequesting]  = useState(false);

  const [payoutModal, setPayoutModal] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [earnRes, bankRes, payoutRes] = await Promise.all([
        storeEarning(),
        storeGetBankDetail().catch(() => null),
        storePayoutHistory().catch(() => null),
      ]);
      const d = earnRes?.data;
      const parsed = parseSummary(earnRes);
      setSummary(parsed);

      if (d?.earning && typeof d.earning === 'object') {
        setEarning({
          total: Number(d.earning.total ?? parsed?.total_earning ?? 0),
          paid: Number(d.earning.paid ?? parsed?.total_paid ?? 0),
          balance: Number(d.earning.balance ?? availableBalance(parsed)),
        });
      } else if (parsed) {
        setEarning({
          total: parsed.total_earning,
          paid: parsed.total_paid,
          balance: availableBalance(parsed),
        });
      } else {
        setEarning(null);
      }

      const historyList = parsePayoutHistory(payoutRes);
      const pendingFromHistory = historyList.find((x: any) => Number(x?.status) === 0);

      // Pending payout request (status 0)
      const pending =
        pendingFromHistory
        || d?.req
        || earnRes?.req
        || (Array.isArray(d?.list) ? d.list.find((x: any) => Number(x?.status) === 0) : null)
        || (Array.isArray(earnRes?.list) ? earnRes.list.find((x: any) => Number(x?.status) === 0) : null)
        || null;
      setReq(pending);

      const finalList = historyList.length
        ? historyList
        : (Array.isArray(d?.list) ? d.list : (Array.isArray(earnRes?.list) ? earnRes.list : []));
      setList(finalList);

      setCurrency(d?.currency || earnRes?.currency || '₹');

      const banksFromEarn = Array.isArray(d?.bank_details) ? d.bank_details : [];
      const banks = banksFromEarn.length ? banksFromEarn : parseBanks(bankRes);
      setBankDetails(banks);
    } catch {
      Alert.alert('Error', 'Failed to load earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const balance = availableBalance(summary, earning);
  const isMonday = new Date().getDay() === 1;
  const hasPending = !!req;
  const hasBalance = balance > 0;
  const canRequest = !hasPending && hasBalance && isMonday;
  const showRequestBtn = !hasPending && hasBalance;

  const openPayoutModal = () => {
    if (!hasBalance) return;
    if (!isMonday) {
      Alert.alert('Not Available', 'Payout requests are available on Mondays only.');
      return;
    }
    if (!bankDetails.length) {
      Alert.alert(
        'No Bank Account',
        'Please add bank details in Settings before requesting a payout.',
      );
      return;
    }
    setSelectedBankId(bankDetails[0]?.id ?? null);
    setPayoutModal(true);
  };

  const submitPayout = async () => {
    if (selectedBankId == null) {
      Alert.alert('Select Account', 'Please select a bank account for payout.');
      return;
    }
    setRequesting(true);
    try {
      const res = await storePayoutRequest(selectedBankId);
      if (res.msg === 'error') {
        Alert.alert('Error', res.error || 'Could not send request.');
      } else {
        setPayoutModal(false);
        Alert.alert('Success', 'Payout request submitted successfully.');
        load();
      }
    } catch {
      Alert.alert('Error', 'Failed to send payout request.');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('manageEarnings')}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY} />}
      >
        {summary && (
          <>
            <View style={s.statsRow}>
              <StatCard
                label="Weekly Earned"
                value={formatMoney(summary.weekly_earning)}
                meta={`${summary.weekly_delivered_orders} delivered`}
                icon="trending-up"
                iconBg="#ede9fe"
                iconColor={PRIMARY}
              />
              <StatCard
                label="Weekly Paid"
                value={formatMoney(summary.weekly_paid)}
                icon="checkmark-done-circle-outline"
                iconBg="#dcfce7"
                iconColor="#16a34a"
              />
            </View>
            <View style={s.statsRow}>
              <StatCard
                label="Weekly Penalties"
                value={formatMoney(summary.weekly_penalties)}
                icon="alert-circle-outline"
                iconBg="#fee2e2"
                iconColor="#dc2626"
              />
              <StatCard
                label="Weekly Incentives"
                value={formatMoney(summary.weekly_incentives)}
                icon="gift-outline"
                iconBg="#dbeafe"
                iconColor="#2563eb"
              />
            </View>
            {!!(summary.week_start_date && summary.week_end_date) && (
              <Text style={s.rangeText}>
                This week: {formatDay(summary.week_start_date)} → {formatDay(summary.week_end_date)}
              </Text>
            )}
          </>
        )}

        <View style={s.balanceCard}>
          <View style={s.balanceLeft}>
            <Text style={s.balanceLabel}>Available Balance</Text>
            <Text style={s.balanceValue}>{formatMoney(balance)}</Text>
            <Text style={s.balanceHint}>
              {hasBalance
                ? 'Your earnings ready for payout'
                : 'No balance available at this time'}
            </Text>
            {!!summary && (
              <Text style={s.balanceBreakdown}>
                Total {formatMoney(summary.total_earning)} − Paid {formatMoney(summary.total_paid)}
              </Text>
            )}
          </View>
          <View style={s.balanceIconWrap}>
            <Ionicons name="wallet-outline" size={32} color="#fff" />
          </View>
        </View>

        {hasPending && req && (
          <View style={s.pendingBanner}>
            <View style={s.pendingIconWrap}>
              <Ionicons name="time-outline" size={22} color="#92400e" />
            </View>
            <View style={s.pendingBody}>
              <Text style={s.pendingTitle}>Payout Request Pending</Text>
              <Text style={s.pendingAmount}>{formatMoney(req.amount)}</Text>
              <Text style={s.pendingDate}>
                Submitted {formatDay(req.created_at)}
              </Text>
              <Text style={s.pendingNote}>Awaiting admin review. You'll be notified once processed.</Text>
            </View>
          </View>
        )}

        {showRequestBtn && (
          <>
            <TouchableOpacity
              style={[s.reqBtn, (!canRequest || requesting) && s.reqBtnDisabled]}
              onPress={openPayoutModal}
              disabled={!canRequest || requesting}
              activeOpacity={0.8}
            >
              {requesting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="paper-plane-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.reqBtnText}>Request Payout of {formatMoney(balance)}</Text>
                  </>
              }
            </TouchableOpacity>
            {!isMonday && (
              <View style={s.mondayNote}>
                <Ionicons name="calendar-outline" size={16} color="#92400e" style={{ marginRight: 6 }} />
                <Text style={s.mondayNoteText}>Payout requests are available on Mondays only.</Text>
              </View>
            )}
          </>
        )}

        {!hasBalance && !hasPending && (
          <View style={s.noBalanceRow}>
            <Ionicons name="information-circle-outline" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
            <Text style={s.noBalanceText}>You have no balance available to request a payout.</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Payout History</Text>

        {list.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="receipt-outline" size={44} color="#e5e7eb" />
            <Text style={s.emptyText}>No payout records yet</Text>
            <Text style={s.emptyHint}>Your payout history will appear here</Text>
          </View>
        ) : (
          list.map((item, i) => {
            const st = resolveStatus(item.status, item.status_text);
            const payoutId = item.payout_id ?? item.id;
            const bankMeta = [
              item.bank_name,
              item.account_number ? maskAccount(item.account_number) : null,
              item.ifsc_code,
            ].filter(Boolean).join(' · ');

            return (
              <View
                key={String(payoutId ?? i)}
                style={[s.payoutCard, i === list.length - 1 && { marginBottom: 0 }]}
              >
                <View style={s.payoutTop}>
                  <View style={s.payoutLeft}>
                    <Text style={s.payoutAmount}>{formatMoney(item.amount)}</Text>
                    <Text style={s.payoutDate}>
                      Requested on {formatDay(item.created_at)}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon as any} size={13} color={st.text} style={{ marginRight: 4 }} />
                    <Text style={[s.statusText, { color: st.text }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Bank / Account Info */}
                {(!!bankMeta || !!item.account_holder_name || !!item.upi_id) && (
                  <View style={s.payoutBankBox}>
                    <View style={s.payoutBankRow}>
                      <Ionicons name="business-outline" size={13} color="#64748b" style={{ marginRight: 5 }} />
                      <Text style={s.payoutBankName} numberOfLines={1}>
                        {bankMeta || item.bank_name || 'Bank Account'}
                      </Text>
                    </View>
                    {!!item.account_holder_name && (
                      <Text style={s.payoutHolderName}>
                        A/C Name: {item.account_holder_name}
                        {item.branch_name ? ` · ${item.branch_name}` : ''}
                      </Text>
                    )}
                    {!!item.upi_id && (
                      <Text style={s.payoutUpi}>UPI: {item.upi_id}</Text>
                    )}
                  </View>
                )}

                {/* Status date if processed */}
                {!!item.status_date && (
                  <View style={s.statusDateRow}>
                    <Ionicons name="checkmark-done-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
                    <Text style={s.statusDate}>
                      Processed on {formatDay(item.status_date)}
                    </Text>
                  </View>
                )}

                {/* Notes (UTR / Ref or reason) */}
                {!!item.notes && (
                  <View style={[s.notesBox, Number(item.status) === 2 ? s.notesBoxDeclined : s.notesBoxInfo]}>
                    <Ionicons
                      name={Number(item.status) === 2 ? 'alert-circle-outline' : 'receipt-outline'}
                      size={13}
                      color={Number(item.status) === 2 ? '#dc2626' : PRIMARY}
                      style={{ marginRight: 6, marginTop: 1 }}
                    />
                    <Text
                      style={[
                        s.notesText,
                        Number(item.status) === 2 ? s.notesTextDeclined : s.notesTextInfo,
                      ]}
                    >
                      {Number(item.status) === 2
                        ? `Reason: ${item.notes}`
                        : `Ref ID/ Remarks: ${item.notes}`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={payoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => !requesting && setPayoutModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Bank Account</Text>
              <TouchableOpacity
                onPress={() => !requesting && setPayoutModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={s.modalAmount}>
              Payout amount: {formatMoney(balance)}
            </Text>

            <ScrollView style={s.bankList} showsVerticalScrollIndicator={false}>
              {bankDetails.map((bank) => {
                const selected = selectedBankId === bank.id;
                return (
                  <TouchableOpacity
                    key={bank.id}
                    style={[s.bankCard, selected && s.bankCardSelected]}
                    onPress={() => setSelectedBankId(bank.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.radio, selected && s.radioSelected]}>
                      {selected && <View style={s.radioDot} />}
                    </View>
                    <View style={s.bankBody}>
                      <Text style={s.bankHolder}>{bank.account_holder_name}</Text>
                      <Text style={s.bankName}>{bank.bank_name}</Text>
                      <Text style={s.bankMeta}>{maskAccount(bank.account_number)} · {bank.ifsc_code}</Text>
                      {!!bank.upi_id && (
                        <Text style={s.bankMeta}>UPI: {bank.upi_id}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[s.confirmBtn, (selectedBankId == null || requesting) && s.confirmBtnDisabled]}
              onPress={submitPayout}
              disabled={selectedBankId == null || requesting}
              activeOpacity={0.85}
            >
              {requesting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.confirmBtnText}>Confirm Payout Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const StatCard = ({
  label, value, meta, icon, iconBg, iconColor,
}: {
  label: string; value: string; meta?: string; icon: any; iconBg: string; iconColor: string;
}) => (
  <View style={s.statCard}>
    <View style={[s.statIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    {!!meta && <Text style={s.statMeta}>{meta}</Text>}
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  scroll: { padding: 16, paddingBottom: 48 },

  statsRow:   { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard:   { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIcon:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue:  { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 3 },
  statLabel:  { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  statMeta:   { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 4 },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryItem: {
    width: '47%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  summaryValueSm: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  rangeText: { marginTop: 12, fontSize: 12, color: '#64748b', fontWeight: '600' },

  balanceCard: { backgroundColor: PRIMARY, borderRadius: 16, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  balanceLeft: { flex: 1 },
  balanceLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  balanceValue:{ fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 6 },
  balanceHint: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  balanceBreakdown: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 8, fontWeight: '600' },
  balanceIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  pendingBanner:  { flexDirection: 'row', backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#fde68a' },
  pendingIconWrap:{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  pendingBody:    { flex: 1 },
  pendingTitle:   { fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 3 },
  pendingAmount:  { fontSize: 22, fontWeight: '900', color: '#78350f', marginBottom: 2 },
  pendingDate:    { fontSize: 11, color: '#b45309', marginBottom: 6 },
  pendingNote:    { fontSize: 12, color: '#92400e', lineHeight: 17 },

  reqBtn:     { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  reqBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0, elevation: 0, marginBottom: 8 },
  reqBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  mondayNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde68a' },
  mondayNoteText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },

  noBalanceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 16 },
  noBalanceText:{ fontSize: 13, color: '#9ca3af', flex: 1 },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 },

  payoutCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1, borderWidth: 1, borderColor: '#f1f5f9' },
  payoutTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  payoutLeft:   { flex: 1, marginRight: 12 },
  payoutAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  payoutDate:   { fontSize: 12, color: '#94a3b8' },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  payoutBankBox:{ marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  payoutBankRow:{ flexDirection: 'row', alignItems: 'center' },
  payoutBankName:{ fontSize: 12, fontWeight: '700', color: '#334155', flex: 1 },
  payoutHolderName:{ fontSize: 11, color: '#64748b', marginTop: 3 },
  payoutUpi:    { fontSize: 11, color: '#64748b', marginTop: 2 },
  statusDateRow:{ flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusDate:   { fontSize: 11, color: '#94a3b8' },
  notesBox:     { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
  notesBoxInfo: { backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ede9fe' },
  notesBoxDeclined:{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2' },
  notesText:    { fontSize: 12, lineHeight: 16, flex: 1 },
  notesTextInfo:{ color: '#4c1d95', fontWeight: '600' },
  notesTextDeclined:{ color: '#b91c1c' },

  emptyBox:  { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#bbb', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#d1d5db', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  modalAmount: { fontSize: 14, color: '#6b7280', fontWeight: '600', marginBottom: 14 },
  bankList: { maxHeight: 320, marginBottom: 14 },
  bankCard: {
    flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 14, padding: 14, marginBottom: 10, backgroundColor: '#fafafa',
  },
  bankCardSelected: { borderColor: PRIMARY, backgroundColor: '#f5f3ff' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#d1d5db',
    marginRight: 12, marginTop: 2, justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  bankBody: { flex: 1 },
  bankHolder: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  bankName: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 4 },
  bankMeta: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  confirmBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#9ca3af' },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
