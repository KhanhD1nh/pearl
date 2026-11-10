import { Pressable, ScrollView, Text, View } from 'react-native';
import { C, haptic, Icon } from '@/components/ui';
import { Theme, THEME_LABEL, usePrefs } from '@/lib/prefs';

// Fixed swatches: a preview must not follow the live scheme.
const SWATCH = {
  light: { bg: '#f2f2f7', card: '#ffffff', line: '#d1d1d6' },
  dark: { bg: '#000000', card: '#1c1c1e', line: '#3a3a3c' },
};

function Preview({ side }: { side: 'light' | 'dark' }) {
  const p = SWATCH[side];
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, padding: 8, gap: 5 }}>
      <View style={{ height: 10, width: '55%', borderRadius: 3, backgroundColor: p.line }} />
      <View style={{ flex: 1, borderRadius: 7, backgroundColor: p.card, padding: 6, gap: 4 }}>
        <View style={{ height: 5, width: '70%', borderRadius: 2, backgroundColor: p.line }} />
        <View style={{ height: 5, width: '40%', borderRadius: 2, backgroundColor: '#8aa83a' }} />
      </View>
    </View>
  );
}

export default function Appearance() {
  const { prefs, set } = usePrefs();
  const cur = prefs?.theme ?? 'dark';
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['light', 'dark', 'system'] as Theme[]).map(t => {
          const on = cur === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={THEME_LABEL[t]}
              onPress={() => { if (!on) { haptic.tap(); set({ theme: t }); } }}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: '100%', aspectRatio: 0.72, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden', flexDirection: 'row', borderWidth: 2.5, borderColor: on ? C.accent : C.separator }}>
                {t === 'system' ? (<><Preview side="light" /><Preview side="dark" /></>) : <Preview side={t} />}
              </View>
              <Text style={{ color: C.label, fontSize: 15, fontWeight: on ? '600' : '400' }}>{THEME_LABEL[t]}</Text>
              <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={22} color={on ? C.accent : C.tertiary} />
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: C.secondary, fontSize: 13, textAlign: 'center', paddingTop: 8 }}>
        {cur === 'system' ? 'Theo cài đặt giao diện của iPhone.' : 'Chọn "Hệ thống" để tự đổi theo iPhone.'}
      </Text>
    </ScrollView>
  );
}
