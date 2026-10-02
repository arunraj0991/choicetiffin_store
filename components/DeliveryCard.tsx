import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';

const PRIMARY = COLORS.primary;

export type DeliveryCardItem = {
  id: number | string;
  order_id?: number | string | null;
  user_name?: string | null;
  user_phone?: string | null;
  meal_name?: string | null;
  thali_name?: string | null;
  meal_type?: string | null;
  mealType?: string | null;
  delSlot?: string | null;
  del_slot?: string | null;
  delivery_date?: string | null;
  delivery_status?: string | null;
  house_no?: string | null;
  address?: string | null;
  zone_name?: string | null;
  rider_name?: string | null;
  meal_description?: string | null;
  des?: string | null;
  desc?: string | null;
  description?: string | null;
  checklist?: any[] | null;
  modify_items?: any[] | string | Record<string, any> | null;
  delivery_instruction?: any;
  delivery_instruction_image?: string | null;
  spInst?: any[] | string | null;
  is_same_customer?: boolean | number | string | null;
  same_customer_badge?: {
    is_same_customer?: boolean | number | string | null;
    badge_text?: string | null;
    total_orders?: number | null;
    phone?: string | null;
  } | null;
};

export function hasChecklistItems(item: { checklist?: any[] | null }): boolean {
  return Array.isArray(item.checklist) && item.checklist.length > 0;
}

export function hasModifyItems(item: { modify_items?: any }): boolean {
  const raw = item?.modify_items;
  if (raw == null) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'string') return raw.trim().length > 0;
  if (typeof raw === 'object') return Object.keys(raw).length > 0;
  return false;
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function lastOrderIdDigits(orderId?: number | string | null, count = 5): string {
  const digits = String(orderId ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-count);
}

export function sameCustomerFromApi(item?: {
  is_same_customer?: unknown;
  same_customer_badge?: {
    is_same_customer?: unknown;
    badge_text?: string | null;
  } | null;
} | null): { show: boolean; text: string } {
  const badge = item?.same_customer_badge;
  const show = isTruthyFlag(badge?.is_same_customer) || isTruthyFlag(item?.is_same_customer);
  const text = String(badge?.badge_text ?? '').trim();
  return { show, text };
}

function prettyKey(key: string) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function formatPrimitive(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

function formatAddon(row: any): string {
  if (typeof row === 'string') return row.trim();
  if (!row || typeof row !== 'object') return '';
  const name = String(row.name ?? row.label ?? row.title ?? row.item ?? '').trim();
  const qty = row.qty ?? row.quantity;
  if (name && qty != null && qty !== '') return `${name} (x${qty})`;
  return name;
}

function formatValue(value: any): string {
  if (value == null) return '';
  const primitive = formatPrimitive(value);
  if (primitive) return primitive;

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    // Array of primitives → "Lunch, Dinner"
    if (value.every(v => ['string', 'number', 'boolean'].includes(typeof v))) {
      return value.map(v => String(v).trim()).filter(Boolean).join(', ');
    }
    // Array of addon-like objects
    const addons = value.map(formatAddon).filter(Boolean);
    if (addons.length) return addons.join(', ');
    return value.map(v => formatValue(v)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const addon = formatAddon(value);
    if (addon) return addon;
    return Object.entries(value)
      .map(([k, v]) => {
        const formatted = formatValue(v);
        return formatted ? `${prettyKey(k)}: ${formatted}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }

  return '';
}

function linesFromModifyObject(obj: Record<string, any>): string[] {
  const preferred = ['meal_name', 'qty', 'quantity', 'addon', 'addons', 'slot', 'modify_date', 'updated_at'];
  const keys = [
    ...preferred.filter(k => obj[k] != null),
    ...Object.keys(obj).filter(k => !preferred.includes(k)),
  ];

  return keys
    .map(key => {
      const formatted = formatValue(obj[key]);
      if (!formatted) return '';
      return `${prettyKey(key)}: ${formatted}`;
    })
    .filter(Boolean);
}

function parseModifyRaw(raw: any): any {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON — keep as plain text (do not split by commas inside JSON-like strings)
    return text;
  }
}

export function modifyItemLabels(item: { modify_items?: any }): string[] {
  const parsed = parseModifyRaw(item?.modify_items);
  if (parsed == null) return [];

  if (typeof parsed === 'string') {
    return [parsed];
  }

  if (Array.isArray(parsed)) {
    const lines: string[] = [];
    parsed.forEach((row, index) => {
      if (row == null) return;
      if (typeof row === 'string' || typeof row === 'number' || typeof row === 'boolean') {
        lines.push(String(row));
        return;
      }
      if (typeof row === 'object') {
        const objLines = linesFromModifyObject(row as Record<string, any>);
        if (objLines.length) {
          if (parsed.length > 1) lines.push(`Item ${index + 1}`);
          lines.push(...objLines);
        }
      }
    });
    return lines;
  }

  if (typeof parsed === 'object') {
    return linesFromModifyObject(parsed as Record<string, any>);
  }

  return [];
}

export function checklistLabels(item: { checklist?: any[] | null }): string[] {
  if (!Array.isArray(item.checklist)) return [];
  return item.checklist
    .map(row => {
      if (typeof row === 'string') return row.trim();
      if (row && typeof row === 'object') {
        return String(row.label ?? row.name ?? row.title ?? row.text ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function deliveryDescription(item: DeliveryCardItem): string {
  const raw = item.meal_description ?? item.des ?? item.desc ?? item.description ?? '';
  return String(raw).trim();
}

function formatNaturalList(items: string[]): string {
  const list = items.map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function labelFromSpInstItem(row: any): string {
  if (row == null) return '';
  if (typeof row === 'string' || typeof row === 'number' || typeof row === 'boolean') {
    return "Less " +cleanInstructionText(row);
  }
  if (typeof row === 'object') {
    return "Less " +cleanInstructionText(
      row.label ?? row.name ?? row.title ?? row.text ?? row.value ?? row.instruction ?? '',
    );
  }
  return '';
}

function parseMaybeJson(raw: any): any {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (!text || text === 'null' || text === '[]' || text === '{}') return null;
  if (
    (text.startsWith('[') && text.endsWith(']')) ||
    (text.startsWith('{') && text.endsWith('}'))
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function isSpInstKey(key: string) {
  const k = String(key || '').toLowerCase().replace(/[_\s-]+/g, '');
  return k === 'spinst' || k === 'specialinstruction' || k === 'specialinstructions';
}

export function formatSpInst(raw: any): string {
  const data = parseMaybeJson(raw);
  if (data == null) return '';

  if (Array.isArray(data)) {
    return formatNaturalList(data.map(labelFromSpInstItem));
  }

  if (typeof data === 'string') {
    return cleanInstructionText(data);
  }

  if (typeof data === 'object') {
    if (Array.isArray(data.spInst)) return formatSpInst(data.spInst);
    return formatNaturalList(
      Object.values(data).map(labelFromSpInstItem),
    );
  }

  return '';
}

export function spInstFromDelivery(item: {
  spInst?: any;
  delivery_instruction?: any;
}): string {
  const direct = formatSpInst(item?.spInst);
  if (direct) return direct;

  const nested = parseMaybeJson(item?.delivery_instruction);
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const key = Object.keys(nested).find(isSpInstKey);
    if (key) return formatSpInst(nested[key]);
  }
  return '';
}

export type InstructionPart = {
  label?: string;
  text: string;
};

export type ParsedDeliveryInstruction = {
  parts: InstructionPart[];
  summary: string;
  image?: string | null;
};

function cleanInstructionText(val: any): string {
  if (val == null) return '';
  return String(val)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\\"/g, '"')
    .trim();
}

export function parseDeliveryInstruction(
  raw: any,
  image?: string | null,
): ParsedDeliveryInstruction | null {
  if (raw == null || raw === '') {
    if (image && typeof image === 'string' && image.trim().length > 0) {
      return {
        parts: [{ text: 'Photo attached' }],
        summary: 'Photo attached',
        image: image.trim(),
      };
    }
    return null;
  }

  let data = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (
      !trimmed ||
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed === '{}' ||
      trimmed === '[]'
    ) {
      return image && typeof image === 'string' && image.trim().length > 0
        ? { parts: [{ text: 'Photo attached' }], summary: 'Photo attached', image: image.trim() }
        : null;
    }
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        data = JSON.parse(trimmed);
      } catch {
        data = trimmed;
      }
    } else {
      data = trimmed;
    }
  }

  const isKitchenKey = (key: string) => {
    const k = String(key || '').toLowerCase().replace(/[_\s-]+/g, '');
    return k === 'kitchen' || k === 'kitcheninstruction' || k === 'kitchennote';
  };
  const isHiddenKey = (key: string) => {
    const k = String(key || '').toLowerCase().replace(/[_\s-]+/g, '');
    return k === 'delivery' || k === 'rider' || k === 'deliveryinstruction' || k === 'riderinstruction' || isSpInstKey(key);
  };

  const addKitchenPart = (key: string | undefined, val: any) => {
    if (key && isHiddenKey(key)) return;
    if (key && !isKitchenKey(key)) return;
    const text = cleanInstructionText(val);
    if (text) parts.push({ label: key ? prettyKey(key) : undefined, text });
  };

  const parts: InstructionPart[] = [];

  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    const text = cleanInstructionText(data);
    if (text) {
      parts.push({ text });
    }
  } else if (Array.isArray(data)) {
    data.forEach(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        const t = cleanInstructionText(item);
        if (t) parts.push({ text: t });
      } else if (item && typeof item === 'object') {
        Object.entries(item).forEach(([k, v]) => {
          addKitchenPart(k, v);
        });
      }
    });
  } else if (data && typeof data === 'object') {
    const kitchenKeys = Object.keys(data).filter(isKitchenKey);
    const keysToUse = kitchenKeys.length > 0
      ? kitchenKeys
      : Object.keys(data).filter(k => !isHiddenKey(k));

    keysToUse.forEach(k => {
      const val = data[k];
      if (val != null && typeof val !== 'object') {
        addKitchenPart(k, val);
      } else if (val && typeof val === 'object') {
        addKitchenPart(k, JSON.stringify(val));
      }
    });
  }

  const validImage = image && typeof image === 'string' && image.trim().length > 0 ? image.trim() : null;

  if (parts.length === 0 && !validImage) return null;

  const summary = parts.map(p => (p.label ? `${p.label}: ${p.text}` : p.text)).join(' · ');
  return {
    parts,
    summary,
    image: validImage,
  };
}

export function fmtDeliveryDate(d?: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  });
}

type Props = {
  item: DeliveryCardItem;
  noZoneLabel?: string;
  instructionLabel?: string;
  noInstructionLabel?: string;
  markAsPickupLabel?: string;
  checklistLabel?: string;
  sameCustomerLabel?: string;
  /** When modified and phone matches another today order / previous modify phone */
  isSameCustomer?: boolean;
  showMarkPickup?: boolean;
  showChecklist?: boolean;
  checklistDisabled?: boolean;
  markPickupDisabled?: boolean;
  marking?: boolean;
  onPress?: () => void;
  onMarkPickup?: () => void;
  onChecklist?: () => void;
};

export default function DeliveryCard({
  item,
  noZoneLabel = 'No zone',
  instructionLabel = 'Special Instruction',
  noInstructionLabel = 'No instruction',
  markAsPickupLabel = 'Mark as Pickup',
  checklistLabel = 'Checklist',
  sameCustomerLabel = 'Same customer',
  isSameCustomer = false,
  showMarkPickup = false,
  showChecklist = false,
  checklistDisabled = false,
  markPickupDisabled = false,
  marking = false,
  onPress,
  onMarkPickup,
  onChecklist,
}: Props) {
  const status = String(item.delivery_status || '').toLowerCase();
  const isScheduled = status === 'scheduled';
  const isDelivered = status === 'delivered';
  const isModified = status === 'modified' || hasModifyItems(item);
  const modLabels = modifyItemLabels(item);
  const name = item.user_name || '?';
  const showActions = showChecklist || showMarkPickup;
  const pickupDisabled = marking || markPickupDisabled;
  const spInstText = spInstFromDelivery(item);
  const parsedInstruction = parseDeliveryInstruction(
    item.delivery_instruction,
    item.delivery_instruction_image,
  );
  const hasInstruction = !!parsedInstruction || !!spInstText;
  const sameCustomer = sameCustomerFromApi(item);
  const showSameCustomer = sameCustomer.show || isSameCustomer;
  const sameCustomerText = sameCustomer.text || sameCustomerLabel;
  const shortOrderId = lastOrderIdDigits(item.order_id ?? item.id);

  const statusBadgeStyle = isModified
    ? styles.badgeModified
    : isDelivered
      ? styles.badgeDelivered
      : isScheduled
        ? styles.badgeScheduled
        : styles.badgeSkipped;
  const statusTextColor = isModified
    ? '#dc2626'
    : isDelivered
      ? '#16a34a'
      : isScheduled
        ? PRIMARY
        : '#64748b';

  const content = (
    <>
      {showSameCustomer && (
        <View style={styles.sameCustomerWrap}>
          {!!shortOrderId && (
            <Text style={styles.sameCustomerOrderId}>#{shortOrderId}</Text>
          )}
          <View style={styles.sameCustomerBanner}>
            <MaterialIcons name="people" size={14} color="#16a34a" />
            <Text style={styles.sameCustomerText}>{sameCustomerText}</Text>
          </View>
        </View>
      )}
      <View style={styles.cardTop}>
        <View style={[styles.cardAvatar, isModified && styles.cardAvatarModified]}>
          <Text style={[styles.cardAvatarText, isModified && { color: '#dc2626' }]}>
            {name[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardName}>{name}</Text>
          {isModified && <Text style={styles.modifiedHint}>Order modified</Text>}
        </View>
        <View style={[styles.statusBadge, statusBadgeStyle]}>
          <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>
            {item.delivery_status}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons name="restaurant" size={16} color="#9ca3af" />
        <Text style={styles.thaliName}>
          {item.thali_name}
          {(item.meal_type || item.mealType) ? (
            <Text style={styles.thaliMealType}>{` · ${item.meal_type || item.mealType}`}</Text>
          ) : null}
        </Text>
        <View style={styles.dot} />
        <MaterialIcons name="calendar-today" size={13} color="#9ca3af" />
        <Text style={styles.infoText}>{fmtDeliveryDate(item.delivery_date)}</Text>
      </View>

      {(isModified || modLabels.length > 0) && (
        <View style={styles.modifyBox}>
          <View style={styles.modifyHeader}>
            <MaterialIcons name="edit-note" size={14} color="#dc2626" />
            <Text style={styles.modifyTitle}>Modified Items</Text>
          </View>
          {modLabels.length > 0 ? (
            modLabels.map((label, i) => (
              <Text key={`${label}-${i}`} style={styles.modifyItem}>• {label}</Text>
            ))
          ) : (
            <Text style={styles.modifyItem}>Modifications applied to this order</Text>
          )}
        </View>
      )}

      {/* Delivery Instruction (displayed instead of "No zone") */}
      {hasInstruction && (
        <View style={styles.instructionBox}>
          <View style={styles.instructionHeader}>
            <MaterialIcons name="speaker-notes" size={13} color="#b45309" />
            <Text style={styles.instructionTitle}>{instructionLabel}</Text>
          </View>
          {!!spInstText && (
            <View style={styles.instructionRow}>
              <Text style={styles.instructionText}> {spInstText}</Text>
            </View>
          )}
          {(parsedInstruction?.parts ?? []).map((p, idx) => (
            <View key={idx} style={styles.instructionRow}>
              {p.label ? (
                <Text style={styles.instructionLabel}>{p.label}: </Text>
              ) : (
                <Text style={styles.instructionBullet}>• </Text>
              )}
              <Text style={styles.instructionText}>{p.text}</Text>
            </View>
          ))}
          {!!parsedInstruction?.image && (
            <View style={styles.instructionImageWrap}>
              <MaterialIcons name="image" size={13} color="#b45309" />
              <Text style={styles.instructionImageText}>Attachment included</Text>
            </View>
          )}
        </View>
      )}

      {(!!item.zone_name || !hasInstruction || !!item.rider_name) && (
        <View style={styles.infoRow}>
          {item.zone_name ? (
            <>
              <MaterialIcons name="map" size={13} color={PRIMARY} />
              <Text style={[styles.infoText, { color: '#334155' }]}>{item.zone_name}</Text>
            </>
          ) : !hasInstruction ? (
            <>
              <MaterialIcons name="speaker-notes-off" size={13} color="#94a3b8" />
              <Text style={[styles.infoText, { color: '#94a3b8' }]}>{noInstructionLabel}</Text>
            </>
          ) : null}

          {!!item.rider_name && (
            <>
              {(!!item.zone_name || !hasInstruction) && <View style={styles.dot} />}
              <MaterialIcons name="directions-bike" size={13} color="#16a34a" />
              <Text style={[styles.infoText, { color: '#16a34a' }]}>{item.rider_name}</Text>
            </>
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.card, isModified && styles.cardModified]}>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}

      {showActions && (
        <View style={[styles.cardActions, isModified && styles.cardActionsModified]}>
          {showChecklist && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.checklistBtn,
                checklistDisabled && styles.deliverBtnDisabled,
              ]}
              onPress={onChecklist}
            >
              <MaterialIcons
                name="checklist"
                size={14}
                color={checklistDisabled ? '#94a3b8' : PRIMARY}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: checklistDisabled ? '#94a3b8' : PRIMARY },
                ]}
              >
                {checklistLabel}
              </Text>
            </TouchableOpacity>
          )}
          {showMarkPickup && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.deliverBtn,
                pickupDisabled && styles.deliverBtnDisabled,
              ]}
              onPress={onMarkPickup}
              disabled={pickupDisabled}
            >
              {marking ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={14}
                    color={markPickupDisabled ? '#94a3b8' : '#16a34a'}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: markPickupDisabled ? '#94a3b8' : '#16a34a' },
                    ]}
                  >
                    {markAsPickupLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardModified: {
    backgroundColor: '#fff7f7',
    borderColor: '#fecaca',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sameCustomerWrap: { marginBottom: 10 },
  sameCustomerOrderId: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
  },
  sameCustomerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sameCustomerText: { fontSize: 11, fontWeight: '800', color: '#16a34a' },
  cardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0ebff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardAvatarModified: { backgroundColor: '#fee2e2' },
  cardAvatarText: { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  modifiedHint: { fontSize: 11, fontWeight: '700', color: '#dc2626', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeScheduled: { backgroundColor: '#f0ebff' },
  badgeDelivered: { backgroundColor: '#dcfce7' },
  badgeSkipped: { backgroundColor: '#f1f5f9' },
  badgeModified: { backgroundColor: '#fee2e2' },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  thaliName: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  thaliMealType: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  infoText: { fontSize: 12, color: '#64748b', flex: 1 },
  modifyBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  modifyHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  modifyTitle: { fontSize: 12, fontWeight: '800', color: '#dc2626' },
  modifyItem: { fontSize: 12, color: '#b91c1c', lineHeight: 18 },
  instructionBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  instructionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  instructionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  instructionBullet: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '700',
  },
  instructionText: {
    fontSize: 12,
    color: '#78350f',
    flex: 1,
    lineHeight: 17,
  },
  instructionImageWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
  },
  instructionImageText: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#cbd5e1', marginHorizontal: 2 },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardActionsModified: { borderTopColor: '#fecaca' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  deliverBtn: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  deliverBtnDisabled: { borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' },
  checklistBtn: { borderColor: PRIMARY, backgroundColor: '#f0ebff' },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});
