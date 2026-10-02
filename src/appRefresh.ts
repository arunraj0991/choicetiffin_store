import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';

export const APP_REFRESH_EVENT = 'app:refresh';

export function emitAppRefresh() {
  DeviceEventEmitter.emit(APP_REFRESH_EVENT);
}

/** Refetch screen data when a OneSignal notification is opened. */
export function useAppRefresh(handler: () => void) {
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(APP_REFRESH_EVENT, handler);
    return () => sub.remove();
  }, [handler]);
}
