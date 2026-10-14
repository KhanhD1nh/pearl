import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, Text } from 'react-native';
import { Stack } from 'expo-router';
import { C } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import * as Oyster from '@/modules/oyster';

// oyster log (peer connections, sync errors), refreshed every 2s.
export default function Log() {
  const { setup } = useWallet();
  const [text, setText] = useState('');
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const read = () => setText(Oyster.log(setup?.network ?? 'mainnet'));
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, [setup?.network]);
  return (
    <ScrollView ref={ref} style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12 }}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}>
      <Stack.Screen options={{ headerRight: () => <Text style={{ color: C.accent, fontSize: 17 }} onPress={() => Share.share({ message: text })}>Chia sẻ</Text> }} />
      <Text selectable style={{ color: C.label, fontFamily: 'Menlo', fontSize: 10 }}>{text || 'Chưa có log.'}</Text>
    </ScrollView>
  );
}
