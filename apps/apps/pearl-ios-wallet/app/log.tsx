import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { C, haptic, Icon } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import * as Oyster from '@/modules/oyster';

// oyster log (peer connections, sync errors), refreshed every 2s.
const level = (l: string) => (/\b(ERR|ERROR|FTL|CRT)\b/.test(l) ? 'err' : /\b(WRN|WARN)\b/.test(l) ? 'warn' : 'info');

export default function Log() {
  const { setup } = useWallet();
  const [text, setText] = useState('');
  const ref = useRef<ScrollView>(null);
  const stick = useRef(true);
  useEffect(() => {
    const read = () => setText(Oyster.log(setup?.network ?? 'mainnet'));
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, [setup?.network]);
  const lines = useMemo(() => (text ? text.split('\n') : []), [text]);
  const color = { err: C.red, warn: C.orange, info: C.secondary };
  return (
    <ScrollView
      ref={ref}
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
      scrollEventThrottle={100}
      onScroll={e => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        stick.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 60;
      }}
      onContentSizeChange={() => stick.current && ref.current?.scrollToEnd({ animated: false })}
    >
      <Stack.Screen options={{ headerRight: () => (
        <Pressable hitSlop={8} disabled={!text} onPress={() => { haptic.tap(); Share.share({ message: text }); }} accessibilityRole="button" accessibilityLabel="Chia sẻ nhật ký" style={{ opacity: text ? 1 : 0.4 }}>
          <Icon name="square.and.arrow.up" size={20} color={C.label} />
        </Pressable>
      ) }} />
      {lines.length ? (
        <View style={{ backgroundColor: C.group, borderRadius: 14, borderCurve: 'continuous', padding: 12 }}>
          <Text selectable style={{ fontFamily: 'Menlo', fontSize: 11, lineHeight: 16 }}>
            {lines.map((l, i) => (
              <Text key={i} style={{ color: color[level(l)] }}>{l}{i < lines.length - 1 ? '\n' : ''}</Text>
            ))}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Icon name="doc.text" size={40} color={C.tertiary} />
          <Text style={{ color: C.secondary, fontSize: 17 }}>Chưa có nhật ký</Text>
        </View>
      )}
    </ScrollView>
  );
}
