import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, useColorScheme, View } from 'react-native';
import { Button, C, Logo } from '@/components/ui';
import { authenticate, PrefsProvider, usePrefs } from '@/lib/prefs';
import { useWallet, WalletProvider } from '@/lib/wallet';

// Native header props take plain colors only (PlatformColor renders as the light default), so pick hex per scheme.
const headerFor = (dark: boolean) => ({
  headerStyle: { backgroundColor: dark ? '#1c1c1e' : '#f2f2f7' },
  headerTintColor: dark ? '#cfe98a' : '#5b7a12',
  headerTitleStyle: { color: dark ? '#ffffff' : '#000000' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: C.bg },
});

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      <Logo size={88} />
      {children}
    </View>
  );
}

// Face ID gate on launch and after the app has been in background. Wallet keeps syncing underneath.
// The Face ID sheet itself flips the app inactive→active, so only prompt while still locked,
// otherwise every successful scan triggers the next prompt.
function useLocked() {
  const { prefs } = usePrefs();
  const [locked, setLocked] = useState(true);
  const lockedRef = useRef(true);
  const prompting = useRef(false);
  const lock = (v: boolean) => { lockedRef.current = v; setLocked(v); };
  const unlock = async () => {
    if (prompting.current || !lockedRef.current) return;
    prompting.current = true;
    try {
      if (await authenticate('Mở khóa Pearl Wallet')) lock(false);
    } finally {
      prompting.current = false;
    }
  };
  useEffect(() => {
    if (!prefs?.faceId) return lock(false);
    unlock();
    // Auto-prompt once per return from background; after a cancel the user taps "Mở khóa".
    let fromBackground = false;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background' && !prompting.current) { lock(true); fromBackground = true; }
      else if (s === 'active' && fromBackground) { fromBackground = false; unlock(); }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.faceId]);
  return { locked: !prefs || (prefs.faceId && locked), unlock };
}

function Gate() {
  const { setup, ready } = useWallet();
  const { locked, unlock } = useLocked();
  const header = headerFor(useColorScheme() === 'dark');
  if (setup === undefined || (setup && !ready)) {
    return (
      <Splash>
        <ActivityIndicator color={C.accent} />
        {setup && <Text style={{ color: C.secondary, fontSize: 15 }}>Đang khởi động ví…</Text>}
      </Splash>
    );
  }
  if (setup && locked) {
    return (
      <Splash>
        <Text style={{ color: C.secondary, fontSize: 15 }}>Pearl Wallet đã khóa</Text>
        <Button icon="faceid" title="Mở khóa" onPress={unlock} style={{ alignSelf: 'stretch' }} />
      </Splash>
    );
  }
  return (
    <Stack screenOptions={header}>
      <Stack.Protected guard={!setup}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!setup}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="send" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [1.0], title: 'Gửi Pearl', headerShown: true }} />
        <Stack.Screen name="receive" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.85, 1.0], title: 'Nhận Pearl', headerShown: true }} />
        <Stack.Screen name="tx/[id]" options={{ title: 'Giao dịch', headerBackTitle: 'Quay lại' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  return (
    <PrefsProvider>
      <WalletProvider>
        <StatusBar style="auto" />
        <Gate />
      </WalletProvider>
    </PrefsProvider>
  );
}
