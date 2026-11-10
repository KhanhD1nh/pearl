import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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

const SUB: Record<Theme, string> = { light: 'Nền sáng, dễ đọc ban ngày', dark: 'Nền tối, dịu mắt ban đêm', system: 'Theo cài đặt của iPhone' };

export default function Appearance() {
  const { prefs, set } = usePrefs();
  const cur = prefs?.theme ?? 'dark';
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
      <View style={{ backgroundColor: '#192c25', borderRadius: 28, borderCurve: 'continuous', padding: 18, gap: 14, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="app" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#304c3d" /><Stop offset="1" stopColor="#101c19" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#app)" />
            <Circle cx="100%" cy="0" r="100" fill="#cfe98a" opacity={0.07} />
          </Svg>
        </View>
        <Text style={{ color: '#d8e6d7', fontSize: 13, fontWeight: '600', letterSpacing: 0.4 }}>XEM TRƯỚC</Text>
        <View accessible accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 150, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', flexDirection: 'row' }}>
          {cur === 'system' ? (<><Preview side="light" /><Preview side="dark" /></>) : <Preview side={cur} />}
        </View>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{THEME_LABEL[cur]}</Text>
      </View>

      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
        {(['light', 'dark', 'system'] as Theme[]).map(t => {
          const on = cur === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={THEME_LABEL[t]}
              accessibilityHint={SUB[t]}
              onPress={() => { if (!on) { haptic.tap(); set({ theme: t }); } }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: on ? C.accentTint : C.group, borderWidth: 2, borderColor: on ? C.accent : 'transparent', opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 64, height: 64, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden', flexDirection: 'row' }}>
                {t === 'system' ? (<><Preview side="light" /><Preview side="dark" /></>) : <Preview side={t} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.label, fontSize: 17, fontWeight: on ? '700' : '500' }}>{THEME_LABEL[t]}</Text>
                <Text style={{ color: C.secondary, fontSize: 13 }}>{SUB[t]}</Text>
              </View>
              <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? C.accent : C.tertiary} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
