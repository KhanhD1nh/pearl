import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { C, fmt, haptic, Icon, Row, Section } from '@/components/ui';
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

  const tone = inc ? C.green : C.label;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 32 }}>
      <View
        accessible
        accessibilityLabel={(inc ? 'Nhận ' : 'Gửi ') + fmt(Math.abs(t.amount)) + ' PRL, ' + (pending ? 'đang chờ xác nhận' : 'đã xác nhận')}
        style={{ backgroundColor: C.group, borderRadius: 28, borderCurve: 'continuous', alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 16 }}
      >
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: inc ? C.greenTint : C.elevated }}>
          <Icon name={inc ? 'arrow.down' : 'arrow.up'} size={30} color={tone} weight="bold" />
        </View>
        <Text style={{ color: C.secondary, fontSize: 15 }}>{inc ? 'Đã nhận' : 'Đã gửi'}</Text>
        <Text selectable adjustsFontSizeToFit numberOfLines={1} style={{ color: tone, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'], maxWidth: '100%' }}>
          {inc ? '+' : '−'}{fmt(Math.abs(t.amount))}
        </Text>
        <Text style={{ color: C.accent, fontSize: 17, fontWeight: '600' }}>PRL</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: pending ? 'rgba(255,149,0,0.15)' : C.elevated, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Icon name={pending ? 'clock' : 'checkmark.circle.fill'} size={14} color={pending ? C.orange : C.secondary} />
          <Text style={{ color: pending ? C.orange : C.secondary, fontSize: 14, fontWeight: '500' }}>
            {pending ? 'Đang chờ xác nhận' : 'Đã xác nhận'}
          </Text>
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
