import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { storeSaveSupportTicket } from '@/src/api/api';
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

type PickedImage = {
  uri: string;
  base64Uri: string;
};

function guessMime(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export default function SupportTicketScreen() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);

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
      Alert.alert(t('error'), t('ticketSubmitFailed'));
      return;
    }
    const uri = asset.uri;
    const mime = asset.mimeType || guessMime(uri);
    setImage({
      uri,
      base64Uri: `data:${mime};base64,${asset.base64}`,
    });
  };

  const submit = async () => {
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
    setSubmitting(true);
    try {
      const payload: {
        subject: string;
        complaint: string;
        user_type: string;
        image?: string;
      } = {
        subject: sub,
        complaint: msg,
        user_type: 'store',
      };
      if (image?.base64Uri) {
        payload.image = image.base64Uri;
      }

      const res = await storeSaveSupportTicket(payload);
      if (res?.status === false || res?.msg === 'error') {
        Alert.alert(t('error'), res?.error || res?.msg || res?.message || t('ticketSubmitFailed'));
        return;
      }
      setSubject('');
      setMessage('');
      setImage(null);
      Alert.alert(t('success'), res?.msg || t('ticketSubmitted'), [
        { text: t('viewComplaints'), onPress: () => router.replace('/complaints') },
        { text: t('done') },
      ]);
    } catch {
      Alert.alert(t('error'), t('ticketSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('supportTicket')}</Text>
        {/* <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/complaints')}
        >
          <MaterialIcons name="list" size={22} color="#fff" />
        </TouchableOpacity> */}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('createSupportTicket')}</Text>

            <Text style={styles.label}>{t('ticketSubject')}</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder={t('ticketSubjectPh')}
              placeholderTextColor="#94a3b8"
              autoCapitalize="sentences"
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
            {image ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} contentFit="cover" />
                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.imageActionBtn} onPress={pickImage} activeOpacity={0.85}>
                    <MaterialIcons name="photo-camera" size={16} color={PRIMARY} />
                    <Text style={styles.imageActionText}>{t('ticketChangeImage')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.imageActionBtn}
                    onPress={() => setImage(null)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="delete-outline" size={16} color="#dc2626" />
                    <Text style={[styles.imageActionText, { color: '#dc2626' }]}>{t('ticketRemoveImage')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} activeOpacity={0.85}>
                <MaterialIcons name="add-photo-alternate" size={22} color={PRIMARY} />
                <Text style={styles.uploadText}>{t('ticketAddImage')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{t('submit')}</Text>}
            </TouchableOpacity>

            {/* <TouchableOpacity
              style={styles.viewLink}
              onPress={() => router.push('/complaints')}
              activeOpacity={0.85}
            >
              <Text style={styles.viewLinkText}>{t('viewComplaints')}</Text>
              <MaterialIcons name="chevron-right" size={18} color={PRIMARY} />
            </TouchableOpacity> */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.secondary },
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

  list: { padding: 16, paddingBottom: 40 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
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
    marginTop: 4,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  viewLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  viewLinkText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});
