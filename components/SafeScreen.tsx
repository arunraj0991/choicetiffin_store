import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, Edge } from 'react-native-safe-area-context';

/** Top padding for colored headers so content clears the status bar / notch. */
export function useSafeHeaderPad(extra = 12): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

type SafeHeaderProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  extraPad?: number;
};

/** Drop-in replacement for header Views — keeps background under the status bar. */
export function SafeHeader({ children, style, extraPad = 12 }: SafeHeaderProps) {
  const pad = useSafeHeaderPad(extraPad);
  return <View style={[{ paddingTop: pad }, style]}>{children}</View>;
}

type SafeScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  backgroundColor?: string;
};

/** Full-screen safe area wrapper for screens without a colored status header. */
export function SafeScreen({
  children,
  style,
  edges = ['top', 'left', 'right'],
  backgroundColor = '#fff',
}: SafeScreenProps) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
