import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text } from 'react-native';
import { Stack } from 'expo-router';
import { C, Icon } from '@/components/ui';
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
    <ScrollView ref={ref} style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}>
      <Stack.Screen options={{ headerRight: () => <Pressable hitSlop={8} disabled={!text} onPress={() => Share.share({ message: text })} accessibilityLabel="Chia sẻ"><Icon name="square.and.arrow.up" size={20} color={C.label} /></Pressable> }} />
      <Text selectable style={{ color: C.label, fontFamily: 'Menlo', fontSize: 11, lineHeight: 15 }}>{text || 'Chưa có log.'}</Text>
    </ScrollView>
  );
}
