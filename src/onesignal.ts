import { Platform } from 'react-native';

type OneSignalModule = typeof import('react-native-onesignal');

let OneSignal: OneSignalModule['OneSignal'] | null = null;
let LogLevel: OneSignalModule['LogLevel'] | null = null;

function canUseNativeOneSignal(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    // Avoid importing react-native-onesignal unless the native module exists.
    // TurboModuleRegistry can be missing during web/SSR evaluation.
    const { TurboModuleRegistry } = require('react-native') as typeof import('react-native');
    return typeof TurboModuleRegistry?.get === 'function' && TurboModuleRegistry.get('OneSignal') != null;
  } catch {
    return false;
  }
}

if (canUseNativeOneSignal()) {
  try {
    const mod = require('react-native-onesignal') as OneSignalModule;
    OneSignal = mod.OneSignal;
    LogLevel = mod.LogLevel;
  } catch (error) {
    console.warn('OneSignal native module failed to load:', error);
  }
}

export { OneSignal, LogLevel };

export function isOneSignalReady(): boolean {
  return OneSignal != null;
}
