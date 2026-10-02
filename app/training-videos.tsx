import React from 'react';
import YoutubeVideoListScreen from '@/components/YoutubeVideoListScreen';
import { storeGetTrainingVideos } from '@/src/api/api';

export default function TrainingVideosScreen() {
  return (
    <YoutubeVideoListScreen
      titleKey="trainingVideos"
      emptyKey="noTrainingVideos"
      errorKey="failedLoadTrainingVideos"
      fetchVideos={storeGetTrainingVideos}
      fallbackTitle="Training Video"
    />
  );
}
