import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ColorValue, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { C, fmt, haptic, Icon, TxRow } from '@/components/ui';
import { useWallet } from '@/lib/wallet';

function MonthButton({ dir, label, onPress }: { dir: 'left' | 'right'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      onPress={() => { haptic.tap(); onPress(); }}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.accentTint : 'transparent' })}
    >
      <Icon name={dir === 'left' ? 'chevron.left' : 'chevron.right'} size={18} color={C.accent} weight="semibold" />
    </Pressable>
  );
}

function Total({ icon, tint, color, label, sign, atoms }: { icon: 'arrow.down' | 'arrow.up'; tint: ColorValue; color: ColorValue; label: string; sign: string; atoms: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.group, borderRadius: 20, borderCurve: 'continuous', padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={12} color={color} weight="bold" />
        </View>
        <Text style={{ color: C.secondary, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      </View>
      <Text selectable adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={{ color, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{sign}{fmt(atoms / 1e8, 8)}</Text>
    </View>
  );
}

export default function Activity() {
  const { txs, loading, pull } = useWallet();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const filtered = txs?.filter(t => t.time * 1000 >= month.getTime() && t.time * 1000 < next.getTime()) ?? [];
  const totals = filtered.reduce((sum, tx) => {
    if (tx.confirmations < 0) return sum;
    const atoms = Math.round(tx.amount * 1e8);
    if (atoms > 0) sum.received += atoms;
    else sum.sent -= atoms;
    return sum;
  }, { received: 0, sent: 0 });
  return (
    <>
      <Stack.Screen options={{ title: 'Hoạt động' }} />
      <FlatList
        style={{ backgroundColor: C.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16 }}
        data={filtered}
        keyExtractor={(t, i) => t.txid + i}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={pull} tintColor={C.accent} />}
        ListHeaderComponent={<View style={{ gap: 14, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.group, borderRadius: 22, borderCurve: 'continuous', paddingHorizontal: 4 }}>
            <MonthButton dir="left" label="Tháng trước" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} />
            <View style={{ flex: 1, alignItems: 'center', gap: 1 }} accessible accessibilityRole="header" accessibilityLabel={`Tháng ${month.getMonth() + 1} năm ${month.getFullYear()}, ${filtered.length} giao dịch`}>
              <Text style={{ color: C.label, fontSize: 17, fontWeight: '600' }}>Tháng {month.getMonth() + 1}/{month.getFullYear()}</Text>
              {txs !== undefined && <Text style={{ color: C.secondary, fontSize: 12 }}>{filtered.length} giao dịch</Text>}
            </View>
            <MonthButton dir="right" label="Tháng sau" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} />
          </View>
          {txs !== undefined && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Total icon="arrow.down" tint={C.greenTint} color={C.green} label="Nhận" sign="+" atoms={totals.received} />
                <Total icon="arrow.up" tint={C.elevated} color={C.label} label="Gửi" sign="−" atoms={totals.sent} />
              </View>
              <Text style={{ color: C.secondary, fontSize: 12, paddingHorizontal: 4 }}>PRL · gồm giao dịch chưa xác nhận; số gửi chưa gồm phí.</Text>
            </View>
          )}
        </View>}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 64, gap: 10 }}>
            <Icon name="clock" size={40} color={C.tertiary} />
            <Text style={{ color: C.secondary, fontSize: 17, fontWeight: '500' }}>{txs === undefined ? 'Đang tải…' : 'Không có giao dịch trong tháng'}</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const first = index === 0, last = index === filtered.length - 1;
          return (
            <View style={{
              backgroundColor: C.group, overflow: 'hidden', borderCurve: 'continuous',
              borderTopLeftRadius: first ? 20 : 0, borderTopRightRadius: first ? 20 : 0,
              borderBottomLeftRadius: last ? 20 : 0, borderBottomRightRadius: last ? 20 : 0,
            }}>
              {index > 0 && <View style={{ height: 0.5, backgroundColor: C.separator, marginLeft: 66 }} />}
              <TxRow amount={item.amount} time={item.time} confirmations={item.confirmations} onPress={() => router.push({ pathname: '/tx/[id]', params: { id: item.txid } })} />
            </View>
          );
        }}
      />
    </>
  );
}
