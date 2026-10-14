import { router, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, RefreshControl, ScrollView, Text, View } from 'react-native';
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
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 12 }}>
        <Text style={{ color: C.secondary, fontSize: 15 }}>Số dư</Text>
        <Text selectable adjustsFontSizeToFit numberOfLines={1} style={{ color: C.label, fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
          {fmt(balance)}
        </Text>
        <Text style={{ color: C.accent, fontSize: 17, fontWeight: '600' }}>PRL</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 64 }}>
        <CircleAction icon="arrow.up" label="Gửi" onPress={() => router.push('/send')} />
        <CircleAction icon="arrow.down" label="Nhận" onPress={() => router.push('/receive')} />
      </View>

      {error && (
        <Section footer={error}>
          <Row icon="exclamationmark.triangle.fill" iconBg={C.red} title="Mất kết nối với ví" value="Thử lại" onPress={load} />
        </Section>
      )}

      {/* Sync status */}
      <Section>
        <Row
          icon={st.synced ? 'checkmark.circle.fill' : 'arrow.triangle.2.circlepath'}
          iconBg={st.synced ? C.green : C.orange}
          title={st.synced ? 'Đã đồng bộ' : 'Đang đồng bộ'}
          value={st.synced ? (sync?.connections ?? 0) + ' peer' : (st.pct * 100).toFixed(1) + '%'}
        />
        {!st.synced && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
            <ProgressBar pct={st.pct} />
            <Text style={{ color: C.secondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>{st.label}</Text>
          </View>
        )}
      </Section>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16 }}>
          <Text style={{ color: C.label, fontSize: 20, fontWeight: '700', flex: 1 }}>Gần đây</Text>
          {!!txs?.length && <Text style={{ color: C.accent, fontSize: 15 }} onPress={() => router.push('/activity')}>Xem tất cả</Text>}
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
