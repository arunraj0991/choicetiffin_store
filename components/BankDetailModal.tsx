import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { storeGetBankDetail, storeSaveBankDetail } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

type Props = {
  visible: boolean;
  onClose: () => void;
};

type BankForm = {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  upi_id: string;
};

const EMPTY_FORM: BankForm = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  upi_id: '',
};

function pickBankData(res: any): Partial<BankForm> {
  const data = res?.data ?? res?.bank ?? res;
  if (!data || typeof data !== 'object') return {};
  return {
    account_holder_name: String(data.account_holder_name ?? ''),
    bank_name: String(data.bank_name ?? ''),
    account_number: String(data.account_number ?? ''),
    ifsc_code: String(data.ifsc_code ?? ''),
    branch_name: String(data.branch_name ?? ''),
    upi_id: String(data.upi_id ?? ''),
  };
}

export default function BankDetailModal({ visible, onClose }: Props) {
  const headerPad = useSafeHeaderPad();
  const { t } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});
  const cardOffsetY = useRef(0);

  const [form, setForm] = useState<BankForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);

  const loadBankDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeGetBankDetail();
      const picked = pickBankData(res);
      setForm({ ...EMPTY_FORM, ...picked });
    } catch {
      setForm(EMPTY_FORM);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadBankDetail();
    } else {
      setForm(EMPTY_FORM);
      setSaving(false);
      setKeyboardPad(0);
    }
  }, [visible, loadBankDetail]);

  useEffect(() => {
    if (!visible) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardPad(e.endCoordinates.height + 24);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardPad(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const setField = (key: keyof BankForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const scrollToField = (key: string) => {
    const y = fieldY.current[key];
    if (y == null) return;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }, Platform.OS === 'ios' ? 50 : 150);
  };

  const save = async () => {
    const payload: BankForm = {
      account_holder_name: form.account_holder_name.trim(),
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim(),
      ifsc_code: form.ifsc_code.trim(),
      branch_name: form.branch_name.trim(),
      upi_id: form.upi_id.trim(),
    };

    if (
      !payload.account_holder_name ||
      !payload.bank_name ||
      !payload.account_number ||
      !payload.ifsc_code ||
      !payload.branch_name ||
      !payload.upi_id
    ) {
      Alert.alert(t('required'), t('bankDetailRequired'));
      return;
    }

    setSaving(true);
    try {
      const res = await storeSaveBankDetail(payload);
      if (res.status === true || res.status === 'success') {
        Keyboard.dismiss();
        Alert.alert(t('successTitle'), res.msg || t('bankDetailSaved'));
        onClose();
      } else {
        Alert.alert(t('error'), res.error || res.message || res.msg || t('bankDetailSaveFailed'));
      }
    } catch {
      Alert.alert(t('error'), t('bankDetailSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fields: {
    key: keyof BankForm;
    label: string;
    placeholder: string;
    keyboard?: 'default' | 'number-pad' | 'email-address';
    autoCap?: 'none' | 'characters' | 'words' | 'sentences';
  }[] = [
    { key: 'account_holder_name', label: t('accountHolderName'), placeholder: t('accountHolderNamePh'), autoCap: 'words' },
    { key: 'bank_name', label: t('bankName'), placeholder: t('bankNamePh'), autoCap: 'words' },
    { key: 'account_number', label: t('accountNumber'), placeholder: t('accountNumberPh'), keyboard: 'number-pad', autoCap: 'none' },
    { key: 'ifsc_code', label: t('ifscCode'), placeholder: t('ifscCodePh'), autoCap: 'characters' },
    { key: 'branch_name', label: t('branchName'), placeholder: t('branchNamePh'), autoCap: 'sentences' },
    { key: 'upi_id', label: t('upiId'), placeholder: t('upiIdPh'), keyboard: 'email-address', autoCap: 'none' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.header, { paddingTop: headerPad }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
            disabled={saving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('bankDetail')}</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + keyboardPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
          >
            <View
              style={styles.card}
              onLayout={e => {
                cardOffsetY.current = e.nativeEvent.layout.y;
              }}
            >
              {fields.map(field => (
                <View
                  key={field.key}
                  style={styles.field}
                  onLayout={e => {
                    fieldY.current[field.key] = cardOffsetY.current + e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[field.key]}
                    onChangeText={text =>
                      setField(field.key, field.key === 'ifsc_code' ? text.toUpperCase() : text)
                    }
                    onFocus={() => scrollToField(field.key)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize={field.autoCap ?? 'none'}
                    autoCorrect={false}
                    keyboardType={field.keyboard ?? 'default'}
                    editable={!saving}
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.secondary },
  header: {
    backgroundColor: '#fff',
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#0f172a' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  saveBtn: {
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#9ca3af' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
