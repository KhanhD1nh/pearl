import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { C, Logo } from '@/components/ui';
import { useWallet, WalletProvider } from '@/lib/wallet';

const dark = { headerStyle: { backgroundColor: C.bg }, headerTintColor: C.accent, headerTitleStyle: { color: C.label }, contentStyle: { backgroundColor: C.bg } };

function Gate() {
  const { setup, ready } = useWallet();
  if (setup === undefined || (setup && !ready)) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Logo size={88} />
        <ActivityIndicator color={C.accent} />
        {setup && <Text style={{ color: C.secondary, fontSize: 15 }}>Đang khởi động ví…</Text>}
      </View>
    );
  }
  return (
    <Stack screenOptions={dark}>
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
    <WalletProvider>
      <StatusBar style="light" />
      <Gate />
    </WalletProvider>
  );
}
