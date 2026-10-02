import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';
import { storeGetLeaveRequest, storeSaveLeaveRequest } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type LeaveItem = {
  id: number | string;
  leave_date?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${m}/${y}`;
}

function toApiDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLongDate(d: Date) {
  return `${WEEKDAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const MIN_ADVANCE_DAYS = 5;

function getMinLeaveDate() {
  const d = startOfToday();
  d.setDate(d.getDate() + MIN_ADVANCE_DAYS);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function parseLeaveList(res: any): LeaveItem[] {
  const raw = res?.data?.data ?? res?.data?.list ?? res?.data ?? res?.list ?? res;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw.id != null || raw.reason != null)) return [raw];
  return [];
}

function statusStyle(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'accepted') return { bg: '#dcfce7', text: '#16a34a' };
  if (s === 'declined' || s === 'rejected') return { bg: '#fee2e2', text: '#dc2626' };
  return { bg: '#fef3c7', text: '#d97706' };
}

function formatApiDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LeaveRequestModal({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const today = useMemo(() => startOfToday(), [visible]);
  const minDate = useMemo(() => getMinLeaveDate(), [visible]);
  const [leaveDate, setLeaveDate] = useState(getMinLeaveDate);
  const [reason, setReason] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [viewYear, setViewYear] = useState(minDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(minDate.getMonth());
  const [gridWidth, setGridWidth] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [leaveList, setLeaveList] = useState<LeaveItem[]>([]);

  const loadLeaveRequests = async () => {
    setLoadingList(true);
    try {
      const res = await storeGetLeaveRequest();
      setLeaveList(parseLeaveList(res));
    } catch {
      setLeaveList([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (visible) {
      const min = getMinLeaveDate();
      setLeaveDate(min);
      setReason('');
      setShowPicker(false);
      setViewYear(min.getFullYear());
      setViewMonth(min.getMonth());
      setSubmitting(false);
      loadLeaveRequests();
    }
  }, [visible]);

  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth]);
  const canGoPrev = new Date(viewYear, viewMonth, 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const daySize = gridWidth > 0 ? Math.floor((gridWidth - 6 * 4) / 7) : 36;

  const onGridLayout = (e: LayoutChangeEvent) => {
    setGridWidth(e.nativeEvent.layout.width);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    if (next < minMonth) return;
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDay = (date: Date) => {
    if (date < minDate) return;
    setLeaveDate(date);
  };

  const confirmDate = () => setShowPicker(false);

  const submit = async () => {
    if (leaveDate < minDate) {
      Alert.alert(t('error'), t('leaveAdvanceNotice'));
      return;
    }
    if (!reason.trim()) {
      Alert.alert(t('required'), t('leaveReasonRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await storeSaveLeaveRequest({
        leave_date: toApiDate(leaveDate),
        reason: reason.trim(),
      });
      if (res.status === true || res.status === 'success') {
        setReason('');
        await loadLeaveRequests();
        Alert.alert(t('successTitle'), res.msg || t('leaveRequestSubmitted'));
      } else {
        Alert.alert(t('error'), res.error || res.message || res.msg || t('somethingWentWrong'));
      }
    } catch {
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <MaterialIcons name="event-busy" size={20} color={PRIMARY} />
              </View>
              <Text style={styles.title}>{t('leaveRequest')}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.noticeBox}>
              <MaterialIcons name="info-outline" size={16} color={PRIMARY} />
              <Text style={styles.noticeText}>{t('leaveAdvanceNotice')}</Text>
            </View>

            <Text style={styles.label}>{t('leaveDate')}</Text>
            <TouchableOpacity
              style={[styles.dateBtn, showPicker && styles.dateBtnActive]}
              onPress={() => {
                setViewYear(leaveDate.getFullYear());
                setViewMonth(leaveDate.getMonth());
                setShowPicker(v => !v);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.dateIconWrap}>
                <MaterialIcons name="calendar-today" size={16} color={PRIMARY} />
              </View>
              <View style={styles.dateTexts}>
                <Text style={styles.datePrimary}>{formatLongDate(leaveDate)}</Text>
                <Text style={styles.dateSecondary}>{formatDate(leaveDate)}</Text>
              </View>
              <MaterialIcons
                name={showPicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={22}
                color={PRIMARY}
              />
            </TouchableOpacity>

            {showPicker && (
              <View style={styles.calendar}>
                <View style={styles.calHero}>
                  <Text style={styles.calHeroYear}>{leaveDate.getFullYear()}</Text>
                  <Text style={styles.calHeroDate}>{formatLongDate(leaveDate)}</Text>
                </View>

                <View style={styles.calBody}>
                  <View style={styles.calHeader}>
                    <TouchableOpacity
                      style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
                      onPress={() => shiftMonth(-1)}
                      disabled={!canGoPrev}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name="chevron-left"
                        size={22}
                        color={canGoPrev ? '#0f172a' : '#cbd5e1'}
                      />
                    </TouchableOpacity>
                    <Text style={styles.calMonth}>
                      {MONTHS[viewMonth]} {viewYear}
                    </Text>
                    <TouchableOpacity
                      style={styles.navBtn}
                      onPress={() => shiftMonth(1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="chevron-right" size={22} color="#0f172a" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.weekRow} onLayout={onGridLayout}>
                    {WEEKDAYS.map((d, i) => (
                      <View key={`${d}-${i}`} style={[styles.weekCell, { width: daySize }]}>
                        <Text style={styles.weekDay}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  {weeks.map((week, wi) => (
                    <View key={`w-${wi}`} style={styles.weekRow}>
                      {week.map((date, di) => {
                        if (!date) {
                          return <View key={`e-${wi}-${di}`} style={{ width: daySize, height: daySize }} />;
                        }
                        const disabled = date < minDate;
                        const selected = sameDay(date, leaveDate);
                        const isToday = sameDay(date, today);
                        return (
                          <TouchableOpacity
                            key={date.toISOString()}
                            style={[styles.dayHit, { width: daySize, height: daySize }]}
                            disabled={disabled}
                            onPress={() => selectDay(date)}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.dayCircle,
                                { width: daySize - 6, height: daySize - 6, borderRadius: (daySize - 6) / 2 },
                                selected && styles.daySelected,
                                isToday && !selected && !disabled && styles.dayToday,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dayText,
                                  disabled && styles.dayDisabled,
                                  selected && styles.daySelectedText,
                                  isToday && !selected && !disabled && styles.dayTodayText,
                                ]}
                              >
                                {date.getDate()}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}

                  <TouchableOpacity style={styles.calDone} onPress={confirmDate} activeOpacity={0.85}>
                    <Text style={styles.calDoneText}>{t('done')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.label}>{t('leaveReason')}</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder={t('leaveReasonPh')}
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>{t('submit')}</Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 18 }]}>{t('leaveHistory')}</Text>
            {loadingList ? (
              <View style={styles.listLoading}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : leaveList.length === 0 ? (
              <Text style={styles.emptyHistory}>{t('noLeaveRequests')}</Text>
            ) : (
              leaveList.map(item => {
                const st = statusStyle(item.status);
                return (
                  <View key={String(item.id)} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyDate}>
                        {formatApiDate(item.leave_date || item.created_at)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusText, { color: st.text }]}>
                          {String(item.status || 'pending')}
                        </Text>
                      </View>
                    </View>
                    {!!item.reason && <Text style={styles.historyReason}>{item.reason}</Text>}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0f172a' },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    lineHeight: 17,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8, letterSpacing: 0.2 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateBtnActive: {
    borderColor: PRIMARY,
    backgroundColor: '#faf8ff',
  },
  dateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTexts: { flex: 1 },
  datePrimary: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  dateSecondary: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  calendar: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9e2f7',
    marginBottom: 14,
  },
  calHero: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  calHeroYear: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  calHeroDate: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  calBody: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  navBtnDisabled: { backgroundColor: '#f8fafc' },
  calMonth: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekCell: { alignItems: 'center', justifyContent: 'center', height: 28 },
  weekDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  dayHit: { alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: PRIMARY,
    backgroundColor: '#f0ebff',
  },
  daySelected: {
    backgroundColor: PRIMARY,
  },
  dayText: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  dayDisabled: { color: '#d1d5db', fontWeight: '500' },
  dayTodayText: { color: PRIMARY },
  daySelectedText: { color: '#fff' },
  calDone: {
    marginTop: 10,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f0ebff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDoneText: { fontSize: 14, fontWeight: '800', color: PRIMARY },
  reasonInput: {
    minHeight: 100,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#9ca3af' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  listLoading: { paddingVertical: 18, alignItems: 'center' },
  emptyHistory: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  historyCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyDate: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  historyReason: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});
