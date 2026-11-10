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

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 28 }}>
      <View
        accessible
        accessibilityLabel={(inc ? 'Nhận ' : 'Gửi ') + fmt(Math.abs(t.amount)) + ' PRL, ' + (pending ? 'đang chờ xác nhận' : 'đã xác nhận')}
        style={{ alignItems: 'center', gap: 10, paddingTop: 12 }}
      >
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: inc ? 'rgba(48,209,88,0.15)' : C.group }}>
          <Icon name={inc ? 'arrow.down' : 'arrow.up'} size={28} color={inc ? C.green : C.label} weight="bold" />
        </View>
        <Text selectable adjustsFontSizeToFit numberOfLines={1} style={{ color: inc ? C.green : C.label, fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'], maxWidth: '100%' }}>
          {inc ? '+' : '−'}{fmt(Math.abs(t.amount))} PRL
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={pending ? 'clock' : 'checkmark.circle.fill'} size={15} color={pending ? C.orange : C.secondary} />
          <Text style={{ color: pending ? C.orange : C.secondary, fontSize: 15 }}>
            {pending ? 'Đang chờ xác nhận' : 'Đã xác nhận'}
          </Text>
        </View>
      </View>

      <Section>
        <Row title="Loại" value={inc ? 'Nhận' : 'Gửi'} />
        <Row title="Thời gian" value={new Date(t.time * 1000).toLocaleString('vi-VN')} />
        <Row title="Xác nhận" value={String(t.confirmations)} />
        {!!t.fee && <Row title="Phí" value={fmt(Math.abs(t.fee)) + ' PRL'} />}
        {!!t.address && <Row title={copied === t.address ? 'Đã chép' : inc ? 'Địa chỉ của bạn' : 'Người nhận'} value={t.address} onPress={() => copy(t.address!)} />}
      </Section>

      <Section header="Mã giao dịch">
        <Row title={copied === id ? 'Đã chép' : id.slice(0, 10) + '…' + id.slice(-10)} onPress={() => Alert.alert('Mở giao dịch?', 'Xem giao dịch trong trình duyệt.', [
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
