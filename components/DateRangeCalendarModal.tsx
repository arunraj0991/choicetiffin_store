import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  visible: boolean;
  start: Date | null;
  end: Date | null;
  minDate?: Date;
  maxDate?: Date;
  onClose: () => void;
  onApply: (start: Date, end: Date) => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isBefore(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isAfter(a: Date, b: Date) {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

function formatDisplay(d: Date) {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

function buildWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function toApiDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(d: Date) {
  return formatDisplay(d);
}

export function formatRangeLabel(start: Date, end: Date) {
  return `${formatDisplay(start)} – ${formatDisplay(end)}`;
}

export default function DateRangeCalendarModal({
  visible,
  start,
  end,
  minDate,
  maxDate,
  onClose,
  onApply,
}: Props) {
  const { t } = useLanguage();
  const min = useMemo(() => (minDate ? startOfDay(minDate) : null), [minDate, visible]);
  const max = useMemo(() => (maxDate ? startOfDay(maxDate) : null), [maxDate, visible]);

  const [draftStart, setDraftStart] = useState<Date | null>(start ? startOfDay(start) : null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(end ? startOfDay(end) : null);
  const [pickingEnd, setPickingEnd] = useState(false);
  const initial = start || end || new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const s = start ? startOfDay(start) : null;
    const e = end ? startOfDay(end) : null;
    setDraftStart(s);
    setDraftEnd(e);
    setPickingEnd(!!s && !e);
    const focus = e || s || new Date();
    setViewYear(focus.getFullYear());
    setViewMonth(focus.getMonth());
  }, [visible, start, end]);

  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth]);
  const daySize = gridWidth > 0 ? Math.floor((gridWidth - 6 * 4) / 7) : 36;
  const canGoPrev = !min || new Date(viewYear, viewMonth, 1) > new Date(min.getFullYear(), min.getMonth(), 1);
  const canGoNext = !max || new Date(viewYear, viewMonth, 1) < new Date(max.getFullYear(), max.getMonth(), 1);
  const canApply = !!draftStart && !!draftEnd;

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    if (min && next < new Date(min.getFullYear(), min.getMonth(), 1)) return;
    if (max && next > new Date(max.getFullYear(), max.getMonth(), 1)) return;
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDay = (day: Date) => {
    if (min && isBefore(day, min)) return;
    if (max && isAfter(day, max)) return;
    const picked = startOfDay(day);

    if (!draftStart || (draftStart && draftEnd) || !pickingEnd) {
      setDraftStart(picked);
      setDraftEnd(null);
      setPickingEnd(true);
      return;
    }

    if (isBefore(picked, draftStart)) {
      setDraftStart(picked);
      setDraftEnd(null);
      setPickingEnd(true);
      return;
    }

    setDraftEnd(picked);
    setPickingEnd(false);
  };

  const handleApply = () => {
    if (!draftStart || !draftEnd) return;
    onApply(draftStart, draftEnd);
    onClose();
  };

  const rangeText = draftStart && draftEnd
    ? formatRangeLabel(draftStart, draftEnd)
    : draftStart
      ? `${formatDisplay(draftStart)} – …`
      : '—';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('selectDateRange')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>
              {draftStart && !draftEnd ? t('startDate') : `${t('startDate')} – ${t('endDate')}`}
            </Text>
            <Text style={styles.selectedValue}>{rangeText}</Text>
          </View>

          <Text style={styles.hint}>
            {!draftStart || (draftStart && draftEnd && !pickingEnd)
              ? t('pickStartDate')
              : t('pickEndDate')}
          </Text>

          <View style={styles.calHeader}>
            <TouchableOpacity
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
              onPress={() => shiftMonth(-1)}
              disabled={!canGoPrev}
            >
              <MaterialIcons name="chevron-left" size={22} color={canGoPrev ? '#0f172a' : '#cbd5e1'} />
            </TouchableOpacity>
            <Text style={styles.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity
              style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
              onPress={() => shiftMonth(1)}
              disabled={!canGoNext}
            >
              <MaterialIcons name="chevron-right" size={22} color={canGoNext ? '#0f172a' : '#cbd5e1'} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow} onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
            {WEEKDAYS.map((d, i) => (
              <View key={`${d}-${i}`} style={[styles.weekCell, { width: daySize }]}>
                <Text style={styles.weekDay}>{d}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={`w-${wi}`} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={`e-${wi}-${di}`} style={{ width: daySize, height: daySize }} />;

                const disabled = (!!min && isBefore(day, min)) || (!!max && isAfter(day, max));
                const isStart = !!draftStart && sameDay(day, draftStart);
                const isEnd = !!draftEnd && sameDay(day, draftEnd);
                const inRange = !!draftStart && !!draftEnd
                  && !isBefore(day, draftStart)
                  && !isAfter(day, draftEnd);

                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[styles.dayHit, { width: daySize, height: daySize }]}
                    disabled={disabled}
                    onPress={() => selectDay(day)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          width: daySize - 6,
                          height: daySize - 6,
                          borderRadius: (daySize - 6) / 2,
                        },
                        inRange && !isStart && !isEnd && styles.dayInRange,
                        (isStart || isEnd) && styles.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          disabled && styles.dayDisabled,
                          inRange && !isStart && !isEnd && styles.dayInRangeText,
                          (isStart || isEnd) && styles.daySelectedText,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
            onPress={handleApply}
            disabled={!canApply}
            activeOpacity={0.85}
          >
            <Text style={styles.applyText}>{t('apply')}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  selectedBox: {
    backgroundColor: '#faf8ff',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  selectedLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 2 },
  selectedValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    marginBottom: 2,
  },
  weekCell: { alignItems: 'center', justifyContent: 'center', height: 28 },
  weekDay: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  dayHit: { alignItems: 'center', justifyContent: 'center' },
  dayCircle: { alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: PRIMARY },
  dayInRange: { backgroundColor: '#ebe4ff' },
  dayText: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  dayDisabled: { color: '#d1d5db', fontWeight: '500' },
  daySelectedText: { color: '#fff' },
  dayInRangeText: { color: PRIMARY },
  applyBtn: {
    marginTop: 14,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  applyBtnDisabled: { opacity: 0.45 },
  applyText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
