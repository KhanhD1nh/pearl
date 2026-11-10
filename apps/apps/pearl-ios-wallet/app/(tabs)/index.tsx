import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
import { C, CircleAction, fmt, Icon, Logo, Row, Section, TxRow } from '@/components/ui';
import { syncStatus, useWallet } from '@/lib/wallet';

// Glides between polled values instead of jumping each tick.
function ProgressBar({ pct }: { pct: number }) {
  const v = useRef(new Animated.Value(pct)).current;
  useEffect(() => { Animated.timing(v, { toValue: pct, duration: 1400, useNativeDriver: false }).start(); }, [pct, v]);
  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: C.elevated, overflow: 'hidden' }}>
      <Animated.View style={{ height: 4, width, backgroundColor: C.orange }} />
    </View>
  );
}

export default function Home() {
  const { balance, sync, peerHeight, txs, loading, load, pull, setup, error } = useWallet();
  const st = syncStatus(sync, peerHeight);
  const recent = txs?.slice(0, 5);
  const [price, setPrice] = useState<number>();
  const [priceFailed, setPriceFailed] = useState(false);

  useEffect(() => {
    if (setup?.network !== 'mainnet') return;
    let active = true;
    const update = async () => {
      try {
        const response = await fetch('https://api.prlscan.com/v1/market/prl');
        if (!response.ok) throw new Error('Market request failed');
        const data = await response.json();
        if (typeof data.price_usd !== 'number' || !Number.isFinite(data.price_usd) || data.price_usd <= 0) throw new Error('Invalid market price');
        if (active) { setPrice(data.price_usd); setPriceFailed(false); }
      } catch {
        if (active) setPriceFailed(true);
      }
    };
    update();
    const timer = setInterval(update, 300000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { active = false; clearInterval(timer); sub.remove(); };
  }, [setup?.network]);

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 28 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={pull} tintColor={C.accent} />}
    >
      <Stack.Screen options={{ title: 'Pearl', headerShown: false }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <Logo size={32} />
        <Text style={{ color: C.label, fontSize: 22, fontWeight: '700', flex: 1 }}>Pearl</Text>
        {setup?.network === 'testnet2' && (
          <Text style={{ color: C.orange, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: C.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>TESTNET</Text>
        )}
      </View>

      {/* Balance hero */}
      <View style={{ alignItems: 'center', gap: 4, paddingTop: 20, paddingBottom: 4 }}>
        <Text style={{ color: C.secondary, fontSize: 15 }}>Số dư</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16 }}>
          <Text selectable adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={{ color: C.label, fontSize: 52, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1, flexShrink: 1 }}>
            {fmt(balance)}
          </Text>
          <Text style={{ color: C.accent, fontSize: 20, fontWeight: '700' }}>PRL</Text>
        </View>
        {setup?.network === 'mainnet' && (
          <Text style={{ color: C.secondary, fontSize: 15, fontVariant: ['tabular-nums'], textAlign: 'center' }}>
            {price !== undefined
              ? (balance !== undefined
                ? `≈ $${(balance * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · 1 PRL ≈ $${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
                : `1 PRL ≈ $${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`) + (priceFailed ? ' · giá cũ' : '')
              : priceFailed
                ? 'Không tải được giá PRL'
                : 'Đang tải giá…'}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 72 }}>
        <CircleAction icon="arrow.up" label="Gửi" onPress={() => router.push('/send')} />
        <CircleAction icon="arrow.down" label="Nhận" onPress={() => router.push('/receive')} />
      </View>

      {error && (
        <Section footer={error}>
          <Row icon="exclamationmark.triangle.fill" iconBg={C.red} title="Mất kết nối với ví" value="Thử lại" onPress={load} />
        </Section>
      )}

      {/* Sync status: compact line when synced, detail card while syncing */}
      {st.synced ? (
        <View accessible accessibilityLabel={`Đã đồng bộ, ${sync?.connections ?? 0} peer`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
          <Text style={{ color: C.secondary, fontSize: 13 }}>Đã đồng bộ · {sync?.connections ?? 0} peer</Text>
        </View>
      ) : (
        <Section>
          <Row icon="arrow.triangle.2.circlepath" iconBg={C.orange} title="Đang đồng bộ" value={(st.pct * 100).toFixed(1) + '%'} />
          <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
            <ProgressBar pct={st.pct} />
            <Text style={{ color: C.secondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>{st.label}</Text>
          </View>
        </Section>
      )}

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16 }}>
          <Text style={{ color: C.label, fontSize: 20, fontWeight: '700', flex: 1 }}>Gần đây</Text>
          {!!txs?.length && <Text accessibilityRole="link" style={{ color: C.accent, fontSize: 15, paddingVertical: 6, paddingLeft: 12 }} onPress={() => router.push('/activity')}>Xem tất cả</Text>}
        </View>
        <Section>
          {txs === undefined && <Row title="Đang tải…" />}
          {txs?.length === 0 && (
            <View style={{ alignItems: 'center', padding: 28, gap: 8 }}>
              <Icon name="tray" size={28} color={C.tertiary} />
              <Text style={{ color: C.secondary, fontSize: 15 }}>Chưa có giao dịch</Text>
            </View>
          )}
          {recent?.map((t, i) => (
            <TxRow key={t.txid + i} amount={t.amount} time={t.time} confirmations={t.confirmations} onPress={() => router.push({ pathname: '/tx/[id]', params: { id: t.txid } })} />
          ))}
        </Section>
      </View>
    </ScrollView>
  );
}
