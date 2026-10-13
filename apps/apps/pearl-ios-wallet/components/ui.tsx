import * as Haptics from 'expo-haptics';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { Children, ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

// iOS dark grouped palette + Pearl accent (desktop index.css --primary).
export const C = {
  bg: '#000000',
  group: '#1c1c1e',
  elevated: '#2c2c2e',
  separator: '#38383a',
  label: '#ffffff',
  secondary: '#98989f',
  tertiary: '#5a5a5f',
  accent: '#cfe98a',
  onAccent: '#0b0d08',
  red: '#ff453a',
  green: '#30d158',
  orange: '#ff9f0a',
};

export const haptic = {
  tap: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

export const fmt = (n: number | undefined, d = 8) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d });

export function Logo({ size = 64 }: { size?: number }) {
  return <Image source={require('@/assets/icon.png')} style={{ width: size, height: size, borderRadius: size * 0.2237 }} />;
}

export function Icon({ name, size = 20, color = C.accent, weight }: { name: SymbolViewProps['name']; size?: number; color?: string; weight?: SymbolViewProps['weight'] }) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} />;
}

// Inset grouped section like iOS Settings. Children are rows; separators are inserted between them.
export function Section({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 6 }}>
      {header && <Text style={{ color: C.secondary, fontSize: 13, textTransform: 'uppercase', paddingHorizontal: 16 }}>{header}</Text>}
      <View style={{ backgroundColor: C.group, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: 0.5, backgroundColor: C.separator, marginLeft: 16 }} />}
            {r}
          </View>
        ))}
      </View>
      {footer && <Text style={{ color: C.secondary, fontSize: 13, paddingHorizontal: 16 }}>{footer}</Text>}
    </View>
  );
}

export function Row({ icon, iconBg, title, value, onPress, chevron, destructive, children }: {
  icon?: SymbolViewProps['name']; iconBg?: string; title: string; value?: ReactNode; onPress?: () => void;
  chevron?: boolean; destructive?: boolean; children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 48, paddingVertical: 10, backgroundColor: pressed ? C.elevated : 'transparent' })}
    >
      {icon && (
        <View style={{ width: 30, height: 30, borderRadius: 7, borderCurve: 'continuous', backgroundColor: iconBg ?? C.elevated, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={17} color={iconBg ? '#fff' : C.accent} />
        </View>
      )}
      <Text style={{ flex: 1, color: destructive ? C.red : C.label, fontSize: 17 }}>{title}</Text>
      {typeof value === 'string' ? <Text selectable style={{ color: C.secondary, fontSize: 17, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="middle">{value}</Text> : value}
      {children}
      {chevron && <Icon name="chevron.right" size={14} color={C.tertiary} weight="semibold" />}
    </Pressable>
  );
}

export function Input(p: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={C.tertiary}
      autoCapitalize="none"
      autoCorrect={false}
      selectionColor={C.accent}
      {...p}
      style={[{ color: C.label, fontSize: 17, paddingHorizontal: 16, paddingVertical: 13, minHeight: 48 }, p.style]}
    />
  );
}

export function Button({ title, onPress, kind = 'filled', icon, disabled, busy, style }: {
  title: string; onPress: () => void; kind?: 'filled' | 'tinted' | 'plain'; icon?: SymbolViewProps['name'];
  disabled?: boolean; busy?: boolean; style?: ViewStyle;
}) {
  const bg = kind === 'filled' ? C.accent : kind === 'tinted' ? 'rgba(207,233,138,0.15)' : 'transparent';
  const fg = kind === 'filled' ? C.onAccent : C.accent;
  return (
    <Pressable
      onPress={() => { haptic.tap(); onPress(); }}
      disabled={disabled || busy}
      style={({ pressed }) => [{
        backgroundColor: bg, borderRadius: 14, borderCurve: 'continuous', height: 52, flexDirection: 'row', gap: 8,
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={17} color={fg} weight="semibold" />}
          <Text style={{ color: fg, fontSize: 17, fontWeight: '600' }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// iOS-style segmented control.
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.group, borderRadius: 9, borderCurve: 'continuous', padding: 2 }}>
      {options.map(([v, label]) => (
        <Pressable
          key={v}
          onPress={() => { haptic.tap(); onChange(v); }}
          style={{ flex: 1, paddingVertical: 7, borderRadius: 7, borderCurve: 'continuous', alignItems: 'center', backgroundColor: value === v ? C.elevated : 'transparent' }}
        >
          <Text style={{ color: C.label, fontSize: 13, fontWeight: value === v ? '600' : '400' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Circular action used on the home screen (like Apple Wallet / Cash).
export function CircleAction({ icon, label, onPress }: { icon: SymbolViewProps['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} style={({ pressed }) => ({ alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={C.onAccent} weight="semibold" />
      </View>
      <Text style={{ color: C.label, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function TxRow({ amount, time, confirmations, onPress }: { amount: number; time: number; confirmations: number; onPress: () => void }) {
  const inc = amount >= 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? C.elevated : 'transparent' })}>
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: inc ? 'rgba(48,209,88,0.15)' : C.elevated }}>
        <Icon name={inc ? 'arrow.down' : 'arrow.up'} size={16} color={inc ? C.green : C.label} weight="bold" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: C.label, fontSize: 16, fontWeight: '500' }}>{inc ? 'Đã nhận' : 'Đã gửi'}</Text>
        <Text style={{ color: confirmations ? C.secondary : C.orange, fontSize: 13 }}>
          {confirmations ? new Date(time * 1000).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Đang chờ xác nhận'}
        </Text>
      </View>
      <Text style={{ color: inc ? C.green : C.label, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {inc ? '+' : '−'}{fmt(Math.abs(amount), 4)}
      </Text>
    </Pressable>
  );
}
