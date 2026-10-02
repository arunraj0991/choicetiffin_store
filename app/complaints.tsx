import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import COLORS from '@/constants/colors';
import { storeEditComplaint, storeGetSupportTickets } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

function loadImagePicker(): typeof import('expo-image-picker') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

type ComplaintItem = {
  id?: number | string;
  user_type?: string | null;
  user_id?: number | string | null;
  subject?: string | null;
  complaint?: string | null;
  image?: string | null;
  reply?: string | null;
  status?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parseComplaintList(res: any): ComplaintItem[] {
  const raw =
    res?.data?.data
    ?? res?.data?.tickets
    ?? res?.data?.list
    ?? res?.data
    ?? res?.list
    ?? res;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw.id != null || raw.subject || raw.complaint)) {
    return [raw];
  }
  return [];
}

function normalizeStatus(status?: string | number | null) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === '1' || s === 'solved' || s === 'closed' || s === 'completed' || s === 'approved') {
    return { bg: '#dcfce7', text: '#16a34a', labelKey: 'ticketResolved' as const };
  }
  if (s === '2' || s === 'rejected' || s === 'declined' || s === 'cancelled') {
    return { bg: '#fee2e2', text: '#dc2626', labelKey: 'ticketRejected' as const };
  }
  if (s === 'progress' || s === 'in_progress' || s === 'processing' || s === 'open') {
    return { bg: '#dbeafe', text: '#2563eb', labelKey: 'ticketInProgress' as const };
  }
  return { bg: '#fef3c7', text: '#d97706', labelKey: 'ticketPending' as const };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function guessMime(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export default function ComplaintsScreen() {
  const headerPad = useSafeHeaderPad();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [list, setList] = useState<ComplaintItem[]>([]);

  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState<ComplaintItem | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuItem, setMenuItem] = useState<ComplaintItem | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await storeGetSupportTickets();
      setList(parseComplaintList(res));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (item: ComplaintItem) => {
    setMenuItem(null);
    setEditing(item);
    setSubject(String(item.subject || ''));
    setMessage(String(item.complaint || ''));
    setImagePreview(item.image ? String(item.image) : null);
    setImageBase64(null);
    setEditVisible(true);
  };

  const closeEdit = () => {
    setEditVisible(false);
    setEditing(null);
    setSubject('');
    setMessage('');
    setImagePreview(null);
    setImageBase64(null);
  };

  const pickImage = async () => {
    const ImagePicker = loadImagePicker();
    if (!ImagePicker) {
      Alert.alert(
        t('error'),
        'Image picker needs a native rebuild. Run: npx expo run:android',
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('error'), t('ticketImagePermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert(t('error'), t('complaintUpdateFailed'));
      return;
    }
    const mime = asset.mimeType || guessMime(asset.uri);
    const dataUri = `data:${mime};base64,${asset.base64}`;
    setImagePreview(asset.uri);
    setImageBase64(dataUri);
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const sub = subject.trim();
    const msg = message.trim();
    if (!sub) {
      Alert.alert(t('error'), t('ticketSubjectRequired'));
      return;
    }
    if (!msg) {
      Alert.alert(t('error'), t('ticketMessageRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload: {
        complaint_id: number | string;
        subject: string;
        complaint: string;
        image?: string;
      } = {
        complaint_id: editing.id,
        subject: sub,
        complaint: msg,
      };
      if (imageBase64) {
        payload.image = imageBase64;
      }

      const res = await storeEditComplaint(payload);
      if (res?.status === false || res?.msg === 'error') {
        Alert.alert(t('error'), res?.error || res?.msg || res?.message || t('complaintUpdateFailed'));
        return;
      }
      Alert.alert(t('success'), res?.msg || t('complaintUpdated'));
      closeEdit();
      load(true);
    } catch {
      Alert.alert(t('error'), t('complaintUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: ComplaintItem }) => {
    const st = normalizeStatus(item.status);
    const title = String(item.subject || t('complaints')).trim();
    const reply = String(item.reply || '').trim();
    const img = item.image ? String(item.image) : null;

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          {img ? (
            <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <MaterialIcons name="image-not-supported" size={22} color="#94a3b8" />
            </View>
          )}

          <View style={styles.cardContent}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setMenuItem(item)}
                hitSlop={8}
              >
                <MaterialIcons name="more-vert" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusText, { color: st.text }]}>{t(st.labelKey)}</Text>
            </View>

            <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>

            <View style={styles.replyBox}>
              <Text style={styles.replyLabel}>{t('adminReply')}</Text>
              <Text style={styles.replyText} numberOfLines={3}>
                {reply || '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('complaints')}</Text>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/support-ticket')}
        >
          <MaterialIcons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="report-problem" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t('noComplaints')}</Text>
              <TouchableOpacity
                style={styles.createLink}
                onPress={() => router.push('/support-ticket')}
                activeOpacity={0.85}
              >
                <Text style={styles.createLinkText}>{t('createSupportTicket')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal
        visible={!!menuItem}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuItem(null)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuItem(null)}
        >
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuOption}
              activeOpacity={0.85}
              onPress={() => {
                if (menuItem) openEdit(menuItem);
              }}
            >
              <MaterialIcons name="visibility" size={20} color={PRIMARY} />
              <Text style={styles.menuOptionText}>{t('view')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeEdit} />
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('editComplaint')}</Text>
              <TouchableOpacity onPress={closeEdit} hitSlop={10}>
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.label}>{t('ticketSubject')}</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder={t('ticketSubjectPh')}
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>{t('ticketMessage')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder={t('ticketMessagePh')}
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>{t('ticketImage')}</Text>
              {imagePreview ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: imagePreview }} style={styles.imagePreview} contentFit="cover" />
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.imageActionBtn} onPress={pickImage} activeOpacity={0.85}>
                      <MaterialIcons name="photo-camera" size={16} color={PRIMARY} />
                      <Text style={styles.imageActionText}>{t('ticketChangeImage')}</Text>
                    </TouchableOpacity>
                    {imageBase64 ? (
                      <TouchableOpacity
                        style={styles.imageActionBtn}
                        onPress={() => {
                          setImageBase64(null);
                          setImagePreview(editing?.image ? String(editing.image) : null);
                        }}
                        activeOpacity={0.85}
                      >
                        <MaterialIcons name="undo" size={16} color="#64748b" />
                        <Text style={[styles.imageActionText, { color: '#64748b' }]}>{t('ticketRemoveImage')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} activeOpacity={0.85}>
                  <MaterialIcons name="add-photo-alternate" size={22} color={PRIMARY} />
                  <Text style={styles.uploadText}>{t('ticketAddImage')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={saveEdit}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitText}>{t('saveChanges')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: PRIMARY,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 4,
    marginBottom: 6,
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -6,
  },
  cardDate: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  replyBox: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
  },
  replyLabel: { fontSize: 11, fontWeight: '800', color: PRIMARY, marginBottom: 3 },
  replyText: { fontSize: 13, color: '#334155', lineHeight: 18 },

  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  createLink: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createLinkText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  modalFooter: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  textArea: { minHeight: 110 },
  uploadBtn: {
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    borderStyle: 'dashed',
    backgroundColor: '#faf8ff',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  uploadText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  imagePreviewWrap: { marginBottom: 12 },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  imageActionText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
