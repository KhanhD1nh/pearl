import { ScrollView } from 'react-native';
import { C, haptic, Icon, Row, Section } from '@/components/ui';
import { Theme, THEME_LABEL, usePrefs } from '@/lib/prefs';

export default function Appearance() {
  const { prefs, set } = usePrefs();
  const cur = prefs?.theme ?? 'dark';
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
      <Section footer="Hệ thống: theo cài đặt sáng/tối của iPhone.">
        {(Object.keys(THEME_LABEL) as Theme[]).map(t => (
          <Row key={t} title={THEME_LABEL[t]} onPress={() => { haptic.tap(); set({ theme: t }); }}
            value={cur === t ? <Icon name="checkmark" size={17} weight="semibold" /> : undefined} />
        ))}
      </Section>
    </ScrollView>
  );
}
