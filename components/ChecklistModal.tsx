import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';
import { storeAddChecklist } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

export type ChecklistDelivery = {
  id: number | string;
  user_name?: string | null;
  thali_name?: string | null;
  meal_type?: string | null;
  mealType?: string | null;
  meal_description?: string | null;
  des?: string | null;
  desc?: string | null;
  description?: string | null;
  checklist?: any[] | null;
  [key: string]: any;
};

export type ParsedChecklistItem = {
  id: string;
  name: string;
  qty: string | null;
  rawLabel: string;
};

type Props = {
  item: ChecklistDelivery | null;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

function selectedLabels(checklist?: any[] | null): string[] {
  if (!Array.isArray(checklist)) return [];
  return checklist
    .map(row => (typeof row === 'string' ? row.trim() : String(row?.label ?? row?.name ?? '').trim()))
    .filter(Boolean);
}

function tokenizeString(str: string): string[] {
  const clean = str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();

  if (!clean) return [];

  const lines = clean.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const tokens: string[] = [];

  for (const line of lines) {
    if (line.includes(',') || line.includes(';')) {
      const parts = line.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
      tokens.push(...parts);
    } else {
      tokens.push(line);
    }
  }

  return tokens;
}

function parseToken(token: string): { name: string; qty: string | null } {
  const text = token
    .replace(/^[\s•\-\*]+/, '')
    .replace(/^\d+[\.\)]\s+/, '')
    .trim();

  if (!text) return { name: '', qty: null };

  // 1. Suffix with colon, dash, or pipe: "Chapati: 4", "Chapati - 4 pcs", "Rice | 1"
  const suffixColon = text.match(
    /^(.+?)\s*[:\-–—\|]\s*(\d+(?:\.\d+)?(?:\s*(?:pcs|pieces|pc|plate|plates|bowl|bowls|box|boxes|pack|packs|x))?)$/i,
  );
  if (suffixColon && suffixColon[1].trim() && suffixColon[2].trim()) {
    return { name: suffixColon[1].trim(), qty: suffixColon[2].trim() };
  }

  // 2. Suffix in parentheses or brackets: "Chapati (4)", "Chapati [4 pcs]", "Chapati (Qty: 4)"
  const suffixParen = text.match(
    /^(.+?)\s*[\(\[]\s*(?:qty[:\s]*)?([xX]?\s*\d+(?:\.\d+)?(?:\s*(?:pcs|pieces|pc|plate|plates|bowl|bowls|box|boxes|pack|packs))?)\s*[\)\]]$/i,
  );
  if (suffixParen && suffixParen[1].trim() && suffixParen[2].trim()) {
    return { name: suffixParen[1].trim(), qty: suffixParen[2].replace(/^[xX]\s*/, '').trim() };
  }

  // 3. Suffix with x or qty: "Chapati x 4", "Dal qty: 1", "Chapati x4"
  const suffixX = text.match(
    /^(.+?)\s+(?:[xX]|qty[:\s]*)\s*(\d+(?:\.\d+)?(?:\s*(?:pcs|pieces|pc|plate|plates|bowl|bowls|box|boxes|pack|packs))?)$/i,
  );
  if (suffixX && suffixX[1].trim() && suffixX[2].trim()) {
    return { name: suffixX[1].trim(), qty: suffixX[2].trim() };
  }

  // 4. Prefix quantity: "4 Chapati", "4x Chapati", "4 pcs Chapati", "1 bowl Dal"
  const prefixQty = text.match(
    /^(\d+(?:\.\d+)?(?:\s*(?:pcs|pieces|pc|plate|plates|bowl|bowls|box|boxes|pack|packs|x))?)\s*[-:]?\s*(.+)$/i,
  );
  if (prefixQty && prefixQty[1].trim() && prefixQty[2].trim()) {
    const q = prefixQty[1].replace(/[xX]$/, '').trim();
    return { name: prefixQty[2].trim(), qty: q };
  }

  // 5. Plain name without quantity
  return { name: text, qty: null };
}

export function parseMealDescriptionToChecklist(item: ChecklistDelivery | null): ParsedChecklistItem[] {
  if (!item) return [];

  const raw = item.meal_description ?? item.des ?? item.desc ?? item.description;
  const result: ParsedChecklistItem[] = [];

  const addParsed = (name: string, qty: any) => {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return;
    const qtyStr = qty != null && String(qty).trim() !== '' ? String(qty).trim() : null;
    const rawLabel = qtyStr ? `${trimmedName} (Qty: ${qtyStr})` : trimmedName;
    result.push({
      id: `item_${result.length}`,
      name: trimmedName,
      qty: qtyStr,
      rawLabel,
    });
  };

  if (raw != null) {
    let parsedJson: any = null;
    if (typeof raw === 'object') {
      parsedJson = raw;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
      ) {
        try {
          parsedJson = JSON.parse(trimmed);
        } catch {
          parsedJson = null;
        }
      }
    }

    if (parsedJson != null) {
      if (Array.isArray(parsedJson)) {
        parsedJson.forEach(row => {
          if (row == null) return;
          if (typeof row === 'string' || typeof row === 'number') {
            const { name, qty } = parseToken(String(row));
            addParsed(name, qty);
          } else if (typeof row === 'object') {
            const name = row.name ?? row.item ?? row.item_name ?? row.title ?? row.label ?? row.thali_name;
            const qty = row.qty ?? row.quantity ?? row.count ?? row.amount;
            if (name) addParsed(String(name), qty);
          }
        });
      } else if (typeof parsedJson === 'object') {
        if (Array.isArray(parsedJson.items)) {
          parsedJson.items.forEach((row: any) => {
            const name = row.name ?? row.item ?? row.item_name ?? row.title ?? row.label;
            const qty = row.qty ?? row.quantity ?? row.count;
            if (name) addParsed(String(name), qty);
          });
        } else {
          Object.entries(parsedJson).forEach(([k, v]) => {
            if (v != null && (typeof v === 'string' || typeof v === 'number')) {
              addParsed(k, v);
            } else if (v && typeof v === 'object') {
              const name = (v as any).name ?? (v as any).item ?? k;
              const qty = (v as any).qty ?? (v as any).quantity;
              addParsed(String(name), qty);
            }
          });
        }
      }
    } else if (typeof raw === 'string') {
      const tokens = tokenizeString(raw);
      tokens.forEach(tok => {
        const { name, qty } = parseToken(tok);
        addParsed(name, qty);
      });
    }
  }

  // Fallback to thali_name if meal_description produced no items
  if (result.length === 0 && item.thali_name) {
    addParsed(item.thali_name, '1');
  }

  return result;
}

function isItemChecked(it: ParsedChecklistItem, selected: string[]): boolean {
  if (selected.length === 0) return false;
  return (
    selected.includes(it.rawLabel) ||
    selected.includes(it.name) ||
    selected.some(s => s.toLowerCase() === it.name.toLowerCase()) ||
    selected.some(s => s.toLowerCase() === it.rawLabel.toLowerCase())
  );
}

/** Pickup is allowed only after every meal_description item is saved on the checklist. */
export function isChecklistComplete(item: ChecklistDelivery | null | undefined): boolean {
  if (!item) return false;
  const expected = parseMealDescriptionToChecklist(item);
  if (expected.length === 0) return false;
  const selected = selectedLabels(item.checklist);
  if (selected.length === 0) return false;
  return expected.every(it => isItemChecked(it, selected));
}

function formatQtyBadge(qty: string | number): string {
  const s = String(qty).trim();
  if (!s) return '';
  if (/^qty/i.test(s) || /^[xX]\s*\d/.test(s)) return s;
  if (/^\d+(\.\d+)?$/.test(s)) return `Qty: ${s}`;
  return s;
}

export default function ChecklistModal({ item, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => parseMealDescriptionToChecklist(item), [item]);

  useEffect(() => {
    if (!item || items.length === 0) {
      setCheckedItems({});
      setSaving(false);
      return;
    }
    const selected = selectedLabels(item.checklist);
    const initial: Record<string, boolean> = {};

    items.forEach(it => {
      initial[it.id] = isItemChecked(it, selected);
    });

    setCheckedItems(initial);
  }, [item, items]);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = items.length > 0 && items.every(it => !!checkedItems[it.id]);
  const packedCount = items.filter(it => !!checkedItems[it.id]).length;

  const toggleSelectAll = () => {
    if (allChecked) {
      setCheckedItems({});
    } else {
      const next: Record<string, boolean> = {};
      items.forEach(it => {
        next[it.id] = true;
      });
      setCheckedItems(next);
    }
  };

  const saveChecklist = async () => {
    if (!item) return;
    const selectedLabelsToSave = items
      .filter(it => checkedItems[it.id])
      .map(it => it.rawLabel);

    if (!allChecked) {
      Alert.alert(t('checklist'), t('checklistMandatory'));
      return;
    }

    setSaving(true);
    try {
      const res = await storeAddChecklist(item.id, selectedLabelsToSave);
      onClose();
      await onSaved?.();
      if (res.msg === 'done' || res.status === true || res.status === 'success') {
        Alert.alert(t('successTitle'), t('checklistSaved'));
      } else {
        Alert.alert(t('error'), res.error || res.message || t('checklistSaveFailed'));
      }
    } catch {
      Alert.alert(t('error'), t('checklistSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.popupOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={close} />
        <View style={styles.popupCard}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('checklist')}</Text>
            <View style={styles.headerRightActions}>
              {items.length > 0 && (
                <TouchableOpacity onPress={toggleSelectAll} hitSlop={8} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllText}>
                    {allChecked ? t('deselectAll') : t('selectAll')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {item && (
            <>
              <Text style={styles.sheetSub}>
                {item.user_name}
                {item.thali_name ? ` · ${item.thali_name}` : ''}
                {(item.meal_type || item.mealType) ? ` · ${item.meal_type || item.mealType}` : ''}
              </Text>

              {items.length > 0 && (
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {packedCount} / {items.length} packed
                  </Text>
                </View>
              )}

              <ScrollView showsVerticalScrollIndicator={false} style={styles.popupScroll}>
                {items.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <MaterialIcons name="checklist" size={36} color="#cbd5e1" />
                    <Text style={styles.emptyText}>{t('noChecklistItems')}</Text>
                  </View>
                ) : (
                  items.map(it => {
                    const done = !!checkedItems[it.id];
                    return (
                      <TouchableOpacity
                        key={it.id}
                        style={[styles.checkRow, done && styles.checkRowDone]}
                        onPress={() => toggleCheck(it.id)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.checkBox, done && styles.checkBoxOn]}>
                          {done ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemName, done && styles.itemNameDone]} numberOfLines={2}>
                            {it.name}
                          </Text>
                        </View>
                        {it.qty ? (
                          <View style={[styles.qtyBadge, done && styles.qtyBadgeDone]}>
                            <Text style={[styles.qtyText, done && styles.qtyTextDone]}>
                              {formatQtyBadge(it.qty)}
                            </Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.saveChecklistBtn,
                  (saving || items.length === 0 || !allChecked) && styles.saveChecklistBtnDisabled,
                ]}
                onPress={saveChecklist}
                disabled={saving || items.length === 0 || !allChecked}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveChecklistText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  popupCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },
  sheetSub: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  progressRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  popupScroll: { maxHeight: 340 },
  saveChecklistBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveChecklistBtnDisabled: { backgroundColor: '#9ca3af' },
  saveChecklistText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  checkRowDone: {
    backgroundColor: '#fafafa',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  itemInfo: {
    flex: 1,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#0f172a', lineHeight: 20 },
  itemNameDone: { color: '#94a3b8', textDecorationLine: 'line-through' },
  qtyBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyBadgeDone: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  qtyTextDone: {
    color: '#94a3b8',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
