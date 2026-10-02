import React from 'react';
import YoutubeVideoListScreen from '@/components/YoutubeVideoListScreen';
import { storeGetDemoVideos } from '@/src/api/api';

export default function DemoVideosScreen() {
  return (
    <YoutubeVideoListScreen
      titleKey="demoVideos"
      emptyKey="noDemoVideos"
      errorKey="failedLoadDemoVideos"
      fetchVideos={storeGetDemoVideos}
      fallbackTitle="Demo Video"
    />
  );
}
