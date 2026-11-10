import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { C, fmt, haptic, Icon, Row, Section } from '@/components/ui';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function TxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { txs, c, load, setup } = useWallet();
  const t = txs?.find(x => x.txid === id);
  const [copied, setCopied] = useState<string>();
  if (!t) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        {txs ? <Text style={{ color: C.secondary, fontSize: 17 }}>Không tìm thấy giao dịch</Text> : <ActivityIndicator />}
      </View>
    );
  }
  const inc = t.amount >= 0;
  const pending = t.confirmations === 0;

  // Resolves true on success so callers do not act (e.g. navigate back) after a failure.
  const act = (f: () => Promise<unknown>, ok: string) =>
    f().then(() => { haptic.success(); load(); Alert.alert(ok); return true; })
      .catch(e => { haptic.error(); Alert.alert('Lỗi', String(e.message)); return false; });

  const copy = (text: string) =>
    Clipboard.setStringAsync(text).then(() => { haptic.success(); setCopied(text); setTimeout(() => setCopied(v => (v === text ? undefined : v)), 1500); })
      .catch(e => Alert.alert('Không sao chép được', String(e.message)));

  const explorer = () =>
    Linking.openURL(`https://explorer.pearlresearch.ai/tx/${encodeURIComponent(id)}?network=${setup?.network === 'testnet2' ? 'testnet' : 'mainnet'}`)
      .catch(e => Alert.alert('Không mở được trình duyệt', String(e.message)));

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 32 }}>
      <View
        accessible
        accessibilityLabel={(inc ? 'Nhận ' : 'Gửi ') + fmt(Math.abs(t.amount)) + ' PRL, ' + (pending ? 'đang chờ xác nhận' : 'đã xác nhận')}
        style={{ backgroundColor: '#192c25', borderRadius: 28, borderCurve: 'continuous', alignItems: 'center', gap: 10, paddingTop: 52, paddingBottom: 26, paddingHorizontal: 16, overflow: 'hidden', marginTop: 36 }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="tx" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={inc ? '#2f5a43' : '#34423d'} /><Stop offset="1" stopColor="#101c19" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#tx)" />
            <Circle cx="100%" cy="0" r="120" fill="#cfe98a" opacity={0.07} />
            <Circle cx="0" cy="100%" r="70" fill="#cfe98a" opacity={0.05} />
          </Svg>
        </View>
        <Text style={{ color: '#d0dbce', fontSize: 15, fontWeight: '500' }}>{inc ? 'Đã nhận' : 'Đã gửi'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, maxWidth: '100%' }}>
          <Text selectable adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={{ color: inc ? '#7ee2a0' : '#ffffff', fontSize: 42, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1, flexShrink: 1 }}>
            {inc ? '+' : '−'}{fmt(Math.abs(t.amount))}
          </Text>
          <Text style={{ color: '#cfe98a', fontSize: 18, fontWeight: '700' }}>PRL</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: pending ? 'rgba(255,149,0,0.22)' : 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 }}>
          <Icon name={pending ? 'clock' : 'checkmark.circle.fill'} size={14} color={pending ? C.orange : '#cfe98a'} />
          <Text style={{ color: pending ? C.orange : '#ffffff', fontSize: 14, fontWeight: '500' }}>
            {pending ? 'Đang chờ xác nhận' : 'Đã xác nhận'}
          </Text>
        </View>
      </View>
      {/* Icon badge straddles the card's top edge. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: inc ? '#2f8f5b' : '#4a5a53', borderWidth: 4, borderColor: C.bg }}>
          <Icon name={inc ? 'arrow.down' : 'arrow.up'} size={28} color="#ffffff" weight="bold" />
        </View>
      </View>

      <Section header="Chi tiết">
        <Row icon="calendar" title="Thời gian" value={new Date(t.time * 1000).toLocaleString('vi-VN')} />
        <Row icon="checkmark.seal" title="Xác nhận" value={String(t.confirmations)} />
        {!!t.fee && <Row icon="percent" title="Phí" value={fmt(Math.abs(t.fee)) + ' PRL'} />}
        {!!t.address && <Row icon={copied === t.address ? 'checkmark' : 'person.crop.circle'} title={copied === t.address ? 'Đã chép' : inc ? 'Địa chỉ của bạn' : 'Người nhận'} value={t.address} onPress={() => copy(t.address!)} />}
      </Section>

      <Section header="Mã giao dịch">
        <Row icon={copied === id ? 'checkmark' : 'number'} title={copied === id ? 'Đã chép' : id.slice(0, 10) + '…' + id.slice(-10)} onPress={() => Alert.alert('Mở giao dịch?', 'Xem giao dịch trong trình duyệt.', [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Sao chép', onPress: () => copy(id) },
          { text: 'Mở', onPress: explorer },
        ])}>
          <Icon name="arrow.up.right.square" size={17} />
        </Row>
      </Section>

      {pending && (
        <Section footer="Xóa chỉ gỡ giao dịch khỏi ví này, không hủy được giao dịch đã lên mạng.">
          <Row icon="arrow.clockwise" title="Phát lại" onPress={() => act(() => wallet.rebroadcast(c, id), 'Đã phát lại')} />
          <Row destructive title="Xóa khỏi ví" onPress={() => Alert.alert('Xóa giao dịch?', '', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa', style: 'destructive', onPress: () => act(() => wallet.remove(c, id), 'Đã xóa').then(ok => { if (ok) router.back(); }) },
          ])} />
        </Section>
      )}
    </ScrollView>
  );
}
