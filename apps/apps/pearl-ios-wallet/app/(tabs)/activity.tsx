import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { C, fmt, haptic, Icon } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import type { Tx } from '@/rpc';

function MonthButton({ dir, label, onPress }: { dir: 'left' | 'right'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      onPress={() => { haptic.tap(); onPress(); }}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)' })}
    >
      <Icon name={dir === 'left' ? 'chevron.left' : 'chevron.right'} size={18} color="#ffffff" weight="semibold" />
    </Pressable>
  );
}

function Stat({ icon, color, label, sign, atoms }: { icon: 'arrow.down' | 'arrow.up'; color: string; label: string; sign: string; atoms: number }) {
  return (
    <View accessible accessibilityLabel={`${label} ${fmt(atoms / 1e8, 8)} PRL`} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, borderCurve: 'continuous', padding: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={12} color={color} weight="bold" />
        <Text style={{ color: '#d0dbce', fontSize: 13, fontWeight: '500' }}>{label}</Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{sign}{fmt(atoms / 1e8, 8)}</Text>
    </View>
  );
}

function Item({ tx, first, last }: { tx: Tx; first: boolean; last: boolean }) {
  const inc = tx.amount >= 0;
  const pending = tx.confirmations === 0;
  const failed = tx.confirmations < 0;
  const status = failed ? 'Không hợp lệ' : pending ? 'Đang chờ xác nhận' : 'Đã xác nhận';
  const time = new Date(tx.time * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const tone = inc ? C.green : C.label;
  return (
    <View style={{
      backgroundColor: C.group, overflow: 'hidden', borderCurve: 'continuous',
      borderTopLeftRadius: first ? 20 : 0, borderTopRightRadius: first ? 20 : 0,
      borderBottomLeftRadius: last ? 20 : 0, borderBottomRightRadius: last ? 20 : 0,
    }}>
      {!first && <View style={{ height: 0.5, backgroundColor: C.separator, marginLeft: 70 }} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${inc ? 'Nhận' : 'Gửi'} ${fmt(Math.abs(tx.amount))} PRL, ${time}, ${status}`}
        onPress={() => router.push({ pathname: '/tx/[id]', params: { id: tx.txid } })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? C.elevated : 'transparent' })}
      >
        <View style={{ width: 40, height: 40, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: inc ? C.greenTint : C.elevated }}>
          <Icon name={inc ? 'arrow.down' : 'arrow.up'} size={16} color={tone} weight="bold" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: C.label, fontSize: 16, fontWeight: '600' }}>{inc ? 'Đã nhận' : 'Đã gửi'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {(pending || failed) && <Icon name="clock" size={12} color={failed ? C.red : C.orange} />}
            <Text style={{ color: failed ? C.red : pending ? C.orange : C.secondary, fontSize: 13 }}>{pending || failed ? status : time}</Text>
          </View>
        </View>
        <Text style={{ color: tone, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {inc ? '+' : '−'}{fmt(Math.abs(tx.amount))}
        </Text>
      </Pressable>
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

  // Group by calendar day, in the order the wallet returned them.
  const sections = useMemo(() => {
    const out: { title: string; data: Tx[] }[] = [];
    for (const t of filtered) {
      const title = new Date(t.time * 1000).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
      const last = out[out.length - 1];
      if (last && last.title === title) last.data.push(t); else out.push({ title, data: [t] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, month]);

  const net = totals.received - totals.sent;
  const netSign = net > 0 ? '+' : net < 0 ? '−' : '';

  return (
    <>
      <Stack.Screen options={{ title: 'Hoạt động' }} />
      <SectionList
        style={{ backgroundColor: C.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        sections={sections}
        stickySectionHeadersEnabled={false}
        keyExtractor={(t, i) => t.txid + i}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={pull} tintColor={C.accent} />}
        ListHeaderComponent={
          <View style={{ backgroundColor: '#192c25', borderRadius: 28, borderCurve: 'continuous', padding: 18, gap: 16, overflow: 'hidden', marginBottom: 8 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
              <Svg width="100%" height="100%">
                <Defs><LinearGradient id="month" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#304c3d" /><Stop offset="1" stopColor="#101c19" /></LinearGradient></Defs>
                <Rect width="100%" height="100%" fill="url(#month)" />
                <Circle cx="100%" cy="0" r="110" fill="#cfe98a" opacity={0.07} />
                <Circle cx="0" cy="100%" r="70" fill="#cfe98a" opacity={0.05} />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MonthButton dir="left" label="Tháng trước" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} />
              <View style={{ flex: 1, alignItems: 'center', gap: 1 }} accessible accessibilityRole="header" accessibilityLabel={`Tháng ${month.getMonth() + 1} năm ${month.getFullYear()}, ${filtered.length} giao dịch`}>
                <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>Tháng {month.getMonth() + 1}/{month.getFullYear()}</Text>
                {txs !== undefined && <Text style={{ color: '#d0dbce', fontSize: 12 }}>{filtered.length} giao dịch</Text>}
              </View>
              <MonthButton dir="right" label="Tháng sau" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} />
            </View>
            {txs !== undefined && (
              <>
                <View accessible accessibilityLabel={`Chênh lệch ${netSign}${fmt(Math.abs(net) / 1e8, 8)} PRL`} style={{ gap: 4, alignItems: 'center' }}>
                  <Text style={{ color: '#d0dbce', fontSize: 13 }}>Chênh lệch trong tháng</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, maxWidth: '100%' }}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={{ color: net > 0 ? '#7ee2a0' : '#ffffff', fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.5, flexShrink: 1 }}>
                      {netSign}{fmt(Math.abs(net) / 1e8, 8)}
                    </Text>
                    <Text style={{ color: '#cfe98a', fontSize: 17, fontWeight: '700' }}>PRL</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Stat icon="arrow.down" color="#7ee2a0" label="Nhận" sign="+" atoms={totals.received} />
                  <Stat icon="arrow.up" color="#ffffff" label="Gửi" sign="−" atoms={totals.sent} />
                </View>
                <Text style={{ color: '#d0dbce', fontSize: 12, textAlign: 'center' }}>Gồm giao dịch chưa xác nhận; số gửi chưa gồm phí.</Text>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.group, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={30} color={C.tertiary} />
            </View>
            <Text style={{ color: C.secondary, fontSize: 17, fontWeight: '500' }}>{txs === undefined ? 'Đang tải…' : 'Không có giao dịch trong tháng'}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={{ color: C.secondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 8, paddingTop: 20, paddingBottom: 8 }}>{section.title}</Text>
        )}
        renderItem={({ item, index, section }) => <Item tx={item} first={index === 0} last={index === section.data.length - 1} />}
      />
    </>
  );
}
