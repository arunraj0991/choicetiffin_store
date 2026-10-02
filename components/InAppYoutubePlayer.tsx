import { MaterialIcons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

import COLORS from '@/constants/colors';

const PRIMARY = COLORS.primary;

type Props = {
  visible: boolean;
  videoId: string | null;
  title?: string;
  onClose: () => void;
};

async function lockPortrait() {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // ignore — Expo Go / unsupported devices
  }
}

async function lockLandscape() {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch {
    // ignore
  }
}

export default function InAppYoutubePlayer({ visible, videoId, title, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const landscape = width > height;
  const playerWidth = isFullscreen || landscape ? width : width;
  const playerHeight = isFullscreen || landscape
    ? Math.max(200, height - (isFullscreen ? 0 : insets.top + insets.bottom + 58))
    : Math.max(240, Math.min(Math.round(width * (9 / 16)), Math.round(height * 0.5)));

  const onReady = useCallback(() => setReady(true), []);

  const restorePortrait = useCallback(async () => {
    setIsFullscreen(false);
    await lockPortrait();
  }, []);

  const handleClose = useCallback(async () => {
    await restorePortrait();
    onClose();
  }, [onClose, restorePortrait]);

  const onFullScreenChange = useCallback(async (status: boolean) => {
    setIsFullscreen(status);
    if (status) await lockLandscape();
    else await lockPortrait();
  }, []);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setIsFullscreen(false);
      lockPortrait();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onShow={() => setReady(false)}
    >
      <View
        style={[
          styles.root,
          !isFullscreen && { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {!isFullscreen && (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{title || 'Video'}</Text>
            <View style={{ width: 38 }} />
          </View>
        )}

        <View style={[styles.playerWrap, isFullscreen && styles.playerWrapFullscreen]}>
          {!!videoId && (
            <YoutubePlayer
              key={videoId}
              height={playerHeight}
              width={playerWidth}
              play
              videoId={videoId}
              forceAndroidAutoplay
              webViewStyle={styles.webview}
              webViewProps={{
                allowsFullscreenVideo: true,
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
                mixedContentMode: 'always',
                setSupportMultipleWindows: false,
                androidLayerType: 'hardware',
              }}
              initialPlayerParams={{
                preventFullScreen: false,
                controls: true,
                rel: false,
              }}
              onReady={onReady}
              onFullScreenChange={onFullScreenChange}
            />
          )}
          {!ready && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  playerWrap: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerWrapFullscreen: {
    ...StyleSheet.absoluteFillObject,
  },
  webview: { backgroundColor: '#000', opacity: 0.99 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
