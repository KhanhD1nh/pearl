import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { C, fmt, haptic, Icon, Logo, Row, Section, TxRow } from '@/components/ui';
import { syncStatus, useWallet } from '@/lib/wallet';

function useReduceMotion() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (active) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduce;
}

// Glides between polled values on the native driver (translateX inside a clipped track); jumps under Reduce Motion.
function ProgressBar({ pct }: { pct: number }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const v = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: pct, duration: reduce ? 0 : 1400, useNativeDriver: true }).start();
  }, [pct, v, reduce]);
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-w, 0], extrapolate: 'clamp' });
  return (
    <View
      accessible accessibilityRole="progressbar" accessibilityLabel="Tiến độ đồng bộ"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={{ height: 6, borderRadius: 3, backgroundColor: C.elevated, overflow: 'hidden' }}
    >
      <Animated.View style={{ height: 6, width: w, borderRadius: 3, backgroundColor: C.orange, transform: [{ translateX }] }} />
    </View>
  );
}

// Wide pill action inside the balance card; native-driven press scale unless Reduce Motion.
function ActionButton({ icon, label, primary, onPress }: { icon: 'arrow.up' | 'arrow.down'; label: string; primary?: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (pressed: boolean) => Animated.timing(scale, { toValue: pressed && !reduce ? 0.96 : 1, duration: reduce ? 0 : 110, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={label}
        onPressIn={() => to(true)} onPressOut={() => to(false)}
        onPress={() => { haptic.tap(); onPress(); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 25, borderCurve: 'continuous',
          backgroundColor: primary ? '#cfe98a' : 'rgba(255,255,255,0.13)', opacity: pressed ? 0.75 : 1,
        })}
      >
        <Icon name={icon} size={17} color={primary ? '#152118' : '#ffffff'} weight="bold" />
        <Text style={{ color: primary ? '#152118' : '#ffffff', fontSize: 17, fontWeight: '600' }}>{label}</Text>
      </Pressable>
    </Animated.View>
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

  const usd = (n: number, max = 4) => n.toLocaleString('en-US', { minimumFractionDigits: max === 2 ? 2 : 0, maximumFractionDigits: max });

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 24 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={pull} tintColor={C.accent} />}
    >
      <Stack.Screen options={{ title: 'Pearl', headerShown: false }} />

      {/* Balance card: identity, amount, fiat, actions, sync */}
      <View style={{ backgroundColor: '#192c25', borderRadius: 28, borderCurve: 'continuous', padding: 22, gap: 22, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="balance" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#304c3d" /><Stop offset="1" stopColor="#101c19" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#balance)" />
            <Circle cx="100%" cy="0" r="120" fill="#cfe98a" opacity={0.07} />
            <Circle cx="100%" cy="0" r="78" fill="#cfe98a" opacity={0.06} />
          </Svg>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo size={32} />
          <Text style={{ color: '#d8e6d7', fontSize: 15, fontWeight: '600', flex: 1 }}>PEARL WALLET</Text>
          {setup?.network === 'testnet2' && (
            <Text style={{ color: C.orange, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: C.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>TESTNET</Text>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text selectable adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={{ color: '#ffffff', fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1, flexShrink: 1 }}>
              {fmt(balance)}
            </Text>
            <Text style={{ color: '#cfe98a', fontSize: 20, fontWeight: '700' }}>PRL</Text>
          </View>
          {setup?.network === 'mainnet' && (
            <Text selectable style={{ color: '#d0dbce', fontSize: 15, fontVariant: ['tabular-nums'] }}>
              {price !== undefined
                ? (balance !== undefined
                  ? `≈ $${usd(balance * price, 2)} · 1 PRL ≈ $${usd(price)}`
                  : `1 PRL ≈ $${usd(price)}`) + (priceFailed ? ' · giá cũ' : '')
                : priceFailed
                  ? 'Không tải được giá PRL'
                  : 'Đang tải giá…'}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ActionButton primary icon="arrow.up" label="Gửi" onPress={() => router.push('/send')} />
          <ActionButton icon="arrow.down" label="Nhận" onPress={() => router.push('/receive')} />
        </View>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />

        {st.synced ? (
          <View accessible accessibilityLabel={`Đã đồng bộ, ${sync?.connections ?? 0} peer`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
            <Text style={{ color: '#d0dbce', fontSize: 13 }}>Đã đồng bộ · {sync?.connections ?? 0} peer</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="arrow.triangle.2.circlepath" size={15} color={C.orange} weight="semibold" />
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '500', flex: 1 }}>Đang đồng bộ</Text>
              <Text style={{ color: '#d0dbce', fontSize: 15, fontVariant: ['tabular-nums'] }}>{(st.pct * 100).toFixed(1) + '%'}</Text>
            </View>
            <ProgressBar pct={st.pct} />
            <Text style={{ color: '#d0dbce', fontSize: 13, fontVariant: ['tabular-nums'] }}>{st.label}</Text>
          </View>
        )}
      </View>

      {error && (
        <Section footer={error}>
          <Row icon="exclamationmark.triangle.fill" iconBg={C.red} title="Mất kết nối với ví" value="Thử lại" onPress={load} />
        </Section>
      )}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
          <Text accessibilityRole="header" style={{ color: C.label, fontSize: 22, fontWeight: '700', flex: 1 }}>Gần đây</Text>
          {!!txs?.length && (
            <Pressable accessibilityRole="link" accessibilityLabel="Xem tất cả hoạt động" hitSlop={8} onPress={() => router.push('/activity')} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingLeft: 12, opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: C.accent, fontSize: 15, fontWeight: '500' }}>Xem tất cả</Text>
            </Pressable>
          )}
        </View>
        <Section>
          {txs === undefined && <Row title="Đang tải…" />}
          {txs?.length === 0 && (
            <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
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
