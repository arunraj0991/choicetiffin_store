import { DeviceEventEmitter } from 'react-native';

export const AUTH_EXPIRED_EVENT = 'auth:expired';

export function emitAuthExpired() {
  DeviceEventEmitter.emit(AUTH_EXPIRED_EVENT);
}
