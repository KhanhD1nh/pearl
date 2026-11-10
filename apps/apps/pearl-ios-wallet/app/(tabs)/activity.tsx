import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { C, fmt, Icon, TxRow } from '@/components/ui';
import { useWallet } from '@/lib/wallet';

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
        ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16, paddingTop: 8 }}>
          <Text style={{ color: C.label, fontSize: 34, fontWeight: '700' }}>Hoạt động</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron.left" size={20} color={C.accent} /></Pressable>
            <Text style={{ color: C.label, fontSize: 18, fontWeight: '600' }}>Tháng {month.getMonth() + 1}/{month.getFullYear()}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron.right" size={20} color={C.accent} /></Pressable>
          </View>
          {txs !== undefined && <View style={{ backgroundColor: C.group, borderRadius: 12, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.secondary, fontSize: 13 }}>Nhận</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={{ color: C.green, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>+{fmt(totals.received / 1e8, 8)}</Text>
              </View>
              <View style={{ width: 0.5, backgroundColor: C.separator, marginHorizontal: 12 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.secondary, fontSize: 13 }}>Gửi</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={{ color: C.label, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>−{fmt(totals.sent / 1e8, 8)}</Text>
              </View>
            </View>
            <Text style={{ color: C.secondary, fontSize: 12 }}>PRL · gồm giao dịch chưa xác nhận; số gửi chưa gồm phí.</Text>
          </View>}
        </View>}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 10 }}>
            <Icon name="clock" size={40} color={C.tertiary} />
            <Text style={{ color: C.label, fontSize: 20, fontWeight: '600' }}>{txs === undefined ? 'Đang tải…' : 'Không có giao dịch trong tháng'}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{
            backgroundColor: C.group, overflow: 'hidden',
            borderTopLeftRadius: index === 0 ? 12 : 0, borderTopRightRadius: index === 0 ? 12 : 0,
            borderBottomLeftRadius: index === filtered.length - 1 ? 12 : 0, borderBottomRightRadius: index === filtered.length - 1 ? 12 : 0,
          }}>
            {index > 0 && <View style={{ height: 0.5, backgroundColor: C.separator, marginLeft: 66 }} />}
            <TxRow amount={item.amount} time={item.time} confirmations={item.confirmations} onPress={() => router.push({ pathname: '/tx/[id]', params: { id: item.txid } })} />
          </View>
        )}
      />
    </>
  );
}
