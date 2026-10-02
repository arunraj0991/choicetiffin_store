import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import COLORS from '@/constants/colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('store_token');
      if (!token) {
        router.replace('/login' as any);
        return;
      }
      const approved = await AsyncStorage.getItem('store_approved');
      if (approved === '0') {
        router.replace('/pending-approval' as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.secondary }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
