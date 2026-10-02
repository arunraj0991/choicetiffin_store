import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import COLORS from '@/constants/colors';

const PRIMARY = COLORS.primary;

export type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner';

type Props = {
  value: MealFilter;
  onChange: (value: MealFilter) => void;
  labels: { all: string; breakfast: string; lunch: string; dinner: string };
  counts?: { all: number; breakfast: number; lunch: number; dinner: number };
};

export type MealLike = {
  delSlot?: string | null;
  del_slot?: string | null;
  mealType?: string | null;
  meal_type?: string | null;
  cate_id?: number | string | null;
  cate_name?: string | null;
  category?: string | null;
  category_name?: string | null;
  cate?: { id?: number | string; name?: string | null } | null;
};

export type MealCate = { id: number | string; name: string };

function classifyLabel(raw: string): Exclude<MealFilter, 'all'> | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return null;

  if (
    v === 'b'
    || v === 'bf'
    || v === 'breakfast'
    || v.startsWith('breakfast')
    || v.includes('break fast')
  ) {
    return 'breakfast';
  }
  if (
    v === 'l'
    || v === 'lunch'
    || v.startsWith('lunch')
  ) {
    return 'lunch';
  }
  if (
    v === 'd'
    || v === 'dinner'
    || v.startsWith('dinner')
  ) {
    return 'dinner';
  }

  if (/\bbreakfast\b/.test(v)) return 'breakfast';
  if (/\blunch\b/.test(v)) return 'lunch';
  if (/\bdinner\b/.test(v)) return 'dinner';

  return null;
}

/** Resolve delivery into exactly one meal slot using meal_type from API. */
export function resolveMealSlot(
  item: MealLike,
  _cates?: MealCate[] | null,
): Exclude<MealFilter, 'all'> | null {
  const fromMealType = classifyLabel(String(item.meal_type ?? item.mealType ?? ''));
  if (fromMealType) return fromMealType;
  return null;
}

export function matchesMealFilter(
  item: MealLike,
  filter: MealFilter,
  cates?: MealCate[] | null,
): boolean {
  if (filter === 'all') return true;
  return resolveMealSlot(item, cates) === filter;
}

/** Lunch tab 8:00 AM–3:00 PM; dinner tab after 3:00 PM. */
export function defaultMealFilterByTime(now = new Date()): MealFilter {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 8 * 60 && minutes < 15 * 60) return 'lunch';
  return 'dinner';
}

/** Lunch checklist 8:00 AM–3:00 PM; dinner checklist 3:00 PM–11:00 PM. */
export function isChecklistTimeEnabled(
  item: MealLike,
  now = new Date(),
): boolean {
  const slot = resolveMealSlot(item);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (slot === 'lunch') return minutes >= 8 * 60 && minutes < 15 * 60;
  if (slot === 'dinner') return minutes >= 15 * 60 && minutes < 23 * 60;
  return true;
}

export function mealFilterCounts(
  list: MealLike[],
  cates?: MealCate[] | null,
): { all: number; breakfast: number; lunch: number; dinner: number } {
  let breakfast = 0;
  let lunch = 0;
  let dinner = 0;

  for (const item of list) {
    const slot = resolveMealSlot(item, cates);
    if (slot === 'breakfast') breakfast += 1;
    else if (slot === 'lunch') lunch += 1;
    else if (slot === 'dinner') dinner += 1;
  }

  return {
    all: list.length,
    breakfast,
    lunch,
    dinner,
  };
}

export default function MealTypeFilter({ value, onChange, labels, counts }: Props) {
  const options: { key: MealFilter; label: string }[] = [
    { key: 'all', label: labels.all },
    { key: 'breakfast', label: labels.breakfast },
    { key: 'lunch', label: labels.lunch },
    { key: 'dinner', label: labels.dinner },
  ];

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map(opt => {
          const active = value === opt.key;
          const count = counts?.[opt.key];
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, active && styles.chipOn]}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{opt.label}</Text>
              {count != null && (
                <View style={[styles.countBadge, active && styles.countBadgeOn]}>
                  <Text style={[styles.countText, active && styles.countTextOn]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  row: {
    paddingHorizontal: 14,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipOn: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  chipTextOn: {
    color: '#fff',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeOn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  countTextOn: {
    color: '#fff',
  },
});
