import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { getMenus, type MenuItem } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;
const VEG_GREEN = '#16a34a';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type MealTab = 'breakfast' | 'lunch' | 'dinner';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function emptyWeek(): Record<string, string> {
  return Object.fromEntries(DAYS.map(d => [d, '']));
}

function buildWeek(
  items: MenuItem[],
  category: MealTab,
  isVeg: boolean,
): Record<string, string> {
  const week = emptyWeek();
  const type = isVeg ? 'veg' : 'non-veg';
  for (const item of items) {
    if (
      String(item.category || '').toLowerCase() !== category ||
      String(item.type || '').toLowerCase() !== type
    ) {
      continue;
    }
    const dayKey = DAYS.find(d => d.toLowerCase() === String(item.day || '').toLowerCase());
    if (dayKey) week[dayKey] = item.menu || '';
  }
  return week;
}

export default function WeeklyMenuModal({ visible, onClose }: Props) {
  const headerPad = useSafeHeaderPad();
  const { t } = useLanguage();
  const [mealTab, setMealTab] = useState<MealTab>('lunch');
  const [vegMenu, setVegMenu] = useState(true);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const todayName = useMemo(() => DAYS[new Date().getDay()], []);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getMenus();
      console.log(res)
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setItems([]);
      setError('Failed to load weekly menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadMenus();
  }, [visible, loadMenus]);

  const menus = useMemo(
    () => buildWeek(items, mealTab, vegMenu),
    [items, mealTab, vegMenu],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: headerPad }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('weeklyMenu') || 'Weekly Menu'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={loadMenus} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="refresh" size={22} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <View style={styles.controls}>
          <View style={styles.segment}>
            {(['breakfast', 'lunch', 'dinner'] as MealTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.segmentBtn, mealTab === tab && styles.segmentBtnOn]}
                onPress={() => setMealTab(tab)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, mealTab === tab && styles.segmentTextOn]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.vegRow}>
            <View style={styles.vegLeft}>
              <View style={[styles.vegDot, !vegMenu && styles.vegDotOff]} />
              <Text style={styles.vegLabel}>{vegMenu ? 'VEG MENU' : 'NON VEG MENU'}</Text>
            </View>
            <Switch
              value={vegMenu}
              onValueChange={setVegMenu}
              trackColor={{ false: '#cbd5e1', true: VEG_GREEN }}
              thumbColor="#fff"
              ios_backgroundColor="#cbd5e1"
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadMenus} activeOpacity={0.85}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              {DAYS.map(day => {
                const value = menus[day]?.trim();
                const isToday = day === todayName;
                return (
                  <View
                    key={`${vegMenu ? 'veg' : 'nonveg'}-${mealTab}-${day}`}
                    style={[styles.dayField, isToday && styles.dayFieldToday]}
                  >
                    <View style={styles.dayLabelWrap}>
                      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text>
                      {isToday && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>{t('today')}</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.dayValue,
                        !value && styles.dayEmpty,
                        isToday && value ? styles.dayValueToday : null,
                      ]}
                    >
                      {value || 'Menu not available'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  header: {
    backgroundColor: '#fff',
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },

  controls: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnOn: {
    backgroundColor: PRIMARY,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextOn: {
    color: '#fff',
  },

  vegRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vegLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vegDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: VEG_GREEN,
  },
  vegDotOff: {
    backgroundColor: '#dc2626',
  },
  vegLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 36 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 8,
  },

  dayField: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 16,
    position: 'relative',
    backgroundColor: '#fff',
  },
  dayFieldToday: {
    borderWidth: 1.5,
    borderColor: VEG_GREEN,
    backgroundColor: '#f0fdf4',
  },
  dayLabelWrap: {
    position: 'absolute',
    top: -9,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  dayLabelToday: {
    backgroundColor: '#f0fdf4',
    color: VEG_GREEN,
    fontWeight: '800',
  },
  todayBadge: {
    backgroundColor: VEG_GREEN,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  todayBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayValue: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  dayValueToday: {
    color: '#15803d',
    fontWeight: '600',
  },
  dayEmpty: {
    color: '#94a3b8',
  },
});
