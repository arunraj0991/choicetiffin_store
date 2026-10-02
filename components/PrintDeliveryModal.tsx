import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import COLORS from '@/constants/colors';
import { storeViewPrint } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

type Props = {
  visible: boolean;
  onClose: () => void;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // eslint-disable-next-line no-undef
  return globalThis.btoa(binary);
}

function decodeArrayBufferToText(buffer: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8').decode(buffer);
  } catch {
    const bytes = new Uint8Array(buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return text;
  }
}

export default function PrintDeliveryModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [html, setHtml] = useState('');
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!visible) {
        setHtml('');
        setPdfUri(null);
        setStoreId('');
        return;
      }

      setLoading(true);
      setHtml('');
      setPdfUri(null);

      try {
        const id = await AsyncStorage.getItem('store_id');
        if (!id) {
          Alert.alert(t('error'), t('printFailed'));
          onClose();
          return;
        }
        if (!cancelled) setStoreId(id);

        const { data, contentType } = await storeViewPrint(id);
        if (cancelled) return;

        const isPdf =
          contentType.includes('application/pdf') ||
          contentType.includes('pdf');

        if (isPdf) {
          const base64 = arrayBufferToBase64(data);
          const uri = `${FileSystem.cacheDirectory}store_print_${id}.pdf`;
          await FileSystem.writeAsStringAsync(uri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (!cancelled) {
            setPdfUri(uri);
            setHtml(`
              <html>
                <head>
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <style>
                    body { font-family: Arial, sans-serif; padding: 28px; text-align: center; color: #334155; }
                    h2 { color: #4A1594; margin-bottom: 8px; }
                    p { font-size: 14px; line-height: 1.5; }
                  </style>
                </head>
                <body>
                  <h2>Print Preview Ready</h2>
                  <p>Tap the download icon to save or share the PDF.</p>
                </body>
              </html>
            `);
          }
        } else {
          const text = decodeArrayBufferToText(data).trim();

          if (text.startsWith('{') || text.startsWith('[')) {
            try {
              const json = JSON.parse(text);
              const msg = json?.error || json?.msg || json?.message || t('printFailed');
              Alert.alert(t('error'), String(msg));
              onClose();
              return;
            } catch {
              // continue as HTML/text
            }
          }

          const previewHtml =
            text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('<HTML')
              ? text
              : `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
                 <body style="font-family:Arial;padding:16px;">${text}</body></html>`;

          if (!cancelled) {
            setHtml(previewHtml);
            setPdfUri(null);
          }
        }
      } catch {
        if (!cancelled) {
          Alert.alert(t('error'), t('printFailed'));
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, onClose, t]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      let uri = pdfUri;

      // Generate PDF from preview HTML when API returned HTML
      if (!uri) {
        if (!html) {
          Alert.alert(t('error'), t('downloadFailed'));
          return;
        }
        const printed = await Print.printToFileAsync({
          html,
          base64: false,
        });
        uri = printed.uri;

        // Copy to a nicer filename when possible
        if (storeId && FileSystem.cacheDirectory) {
          const dest = `${FileSystem.cacheDirectory}today_deliveries_${storeId}.pdf`;
          try {
            await FileSystem.copyAsync({ from: uri, to: dest });
            uri = dest;
          } catch {
            // keep original print uri
          }
        }
        setPdfUri(uri);
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('error'), t('downloadFailed'));
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: t('downloadPdf'),
        UTI: 'com.adobe.pdf',
      });
    } catch {
      Alert.alert(t('error'), t('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const close = () => {
    if (!loading && !downloading) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={close} disabled={loading || downloading}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('printPreview')}</Text>
          <TouchableOpacity
            style={[styles.headerBtn, (loading || downloading || (!html && !pdfUri)) && styles.headerBtnDisabled]}
            onPress={downloadPdf}
            disabled={loading || downloading || (!html && !pdfUri)}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="download" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>{t('printPreview')}...</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={
              html
                ? { html }
                : pdfUri
                  ? { uri: pdfUri }
                  : { html: '<html><body></body></html>' }
            }
            style={styles.webview}
            startInLoadingState
            allowFileAccess
            allowUniversalAccessFromFileURLs
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnDisabled: { opacity: 0.5 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  webview: { flex: 1, backgroundColor: '#f8fafc' },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
