import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import InAppYoutubePlayer from '@/components/InAppYoutubePlayer';
import { useSafeHeaderPad } from '@/components/SafeScreen';

import COLORS from '@/constants/colors';
import { type TrainingVideo } from '@/src/api/api';
import { useLanguage } from '@/src/i18n/context';

const PRIMARY = COLORS.primary;

function parseVideoList(res: any): TrainingVideo[] {
  const raw =
    res?.data?.data
    ?? res?.data?.videos
    ?? res?.data?.list
    ?? res?.data
    ?? res?.videos
    ?? res?.list
    ?? res;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw.id != null || raw.url || raw.youtube_url || raw.link)) {
    return [raw];
  }
  return [];
}

function extractYoutubeId(input?: string | null): string | null {
  if (!input) return null;
  const value = String(input).trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/i,
    /[?&]v=([\w-]{11})/i,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function videoIdFromItem(item: TrainingVideo): string | null {
  return extractYoutubeId(
    item.youtube_id
    || item.video_id
    || item.url
    || item.link
    || item.youtube_url
    || item.video_url,
  );
}

function videoTitle(item: TrainingVideo, fallback: string): string {
  return String(item.title || item.name || fallback).trim();
}

function videoThumb(item: TrainingVideo): string | null {
  if (item.thumbnail || item.thumb || item.image) {
    return String(item.thumbnail || item.thumb || item.image);
  }
  const id = extractYoutubeId(
    item.youtube_id
    || item.video_id
    || item.url
    || item.link
    || item.youtube_url
    || item.video_url,
  );
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

type Props = {
  titleKey: 'trainingVideos' | 'demoVideos';
  emptyKey: 'noTrainingVideos' | 'noDemoVideos';
  errorKey: 'failedLoadTrainingVideos' | 'failedLoadDemoVideos';
  fetchVideos: () => Promise<any>;
  fallbackTitle: string;
};

export default function YoutubeVideoListScreen({
  titleKey,
  emptyKey,
  errorKey,
  fetchVideos,
  fallbackTitle,
}: Props) {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [error, setError] = useState('');
  const [activeVideo, setActiveVideo] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await fetchVideos();
      setVideos(parseVideoList(res));
    } catch {
      setVideos([]);
      setError(t(errorKey));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, fetchVideos, errorKey]);

  useEffect(() => { load(); }, [load]);

  const openVideo = (item: TrainingVideo) => {
    const id = videoIdFromItem(item);
    if (!id) return;
    setActiveVideo({ id, title: videoTitle(item, fallbackTitle) });
  };

  const renderItem = ({ item }: { item: TrainingVideo }) => {
    const thumb = videoThumb(item);
    const title = videoTitle(item, fallbackTitle);
    const desc = String(item.description || '').trim();

    return (
      <TouchableOpacity style={s.card} onPress={() => openVideo(item)} activeOpacity={0.85}>
        <View style={s.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" />
          ) : (
            <View style={s.thumbFallback}>
              <MaterialIcons name="ondemand-video" size={36} color="#cbd5e1" />
            </View>
          )}
          <View style={s.playBadge}>
            <MaterialIcons name="play-arrow" size={22} color="#fff" />
          </View>
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>
          {!!desc && <Text style={s.cardDesc} numberOfLines={2}>{desc}</Text>}
          <View style={s.watchRow}>
            <MaterialIcons name="play-circle-outline" size={16} color={PRIMARY} />
            <Text style={s.watchText}>{t('watchVideo')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t(titleKey)}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()} activeOpacity={0.85}>
            <Text style={s.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <MaterialIcons name="ondemand-video" size={48} color="#cbd5e1" />
              <Text style={s.emptyText}>{t(emptyKey)}</Text>
            </View>
          }
        />
      )}

      <InAppYoutubePlayer
        visible={!!activeVideo}
        videoId={activeVideo?.id ?? null}
        title={activeVideo?.title}
        onClose={() => setActiveVideo(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
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

  list: { padding: 14, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#e2e8f0',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  watchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  watchText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 12, textAlign: 'center' },
});
