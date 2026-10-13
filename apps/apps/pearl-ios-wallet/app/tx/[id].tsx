import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { C, fmt, haptic, Icon, Row, Section } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function TxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { txs, c, load } = useWallet();
  const t = txs?.find(x => x.txid === id);
  if (!t) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const inc = t.amount >= 0;

  const act = (f: () => Promise<unknown>, ok: string) =>
    f().then(() => { haptic.success(); load(); Alert.alert(ok); }).catch(e => { haptic.error(); Alert.alert('Lỗi', String(e.message)); });

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 28 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: inc ? 'rgba(48,209,88,0.15)' : C.group }}>
          <Icon name={inc ? 'arrow.down' : 'arrow.up'} size={28} color={inc ? C.green : C.label} weight="bold" />
        </View>
        <Text selectable style={{ color: inc ? C.green : C.label, fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {inc ? '+' : '−'}{fmt(Math.abs(t.amount))} PRL
        </Text>
        <Text style={{ color: t.confirmations ? C.secondary : C.orange, fontSize: 15 }}>
          {t.confirmations ? 'Đã xác nhận' : 'Đang chờ xác nhận'}
        </Text>
      </View>

      <Section>
        <Row title="Loại" value={inc ? 'Nhận' : 'Gửi'} />
        <Row title="Thời gian" value={new Date(t.time * 1000).toLocaleString('vi-VN')} />
        <Row title="Xác nhận" value={String(t.confirmations)} />
        {!!t.fee && <Row title="Phí" value={fmt(Math.abs(t.fee)) + ' PRL'} />}
        {!!t.address && <Row title="Địa chỉ" value={t.address} />}
      </Section>

      <Section header="Mã giao dịch">
        <Row title={id.slice(0, 10) + '…' + id.slice(-10)} onPress={async () => { await Clipboard.setStringAsync(id); haptic.success(); Alert.alert('Đã chép mã giao dịch'); }}>
          <Icon name="doc.on.doc" size={17} />
        </Row>
      </Section>

      {t.confirmations === 0 && (
        <Section footer="Phát lại nếu giao dịch bị kẹt. Xóa chỉ gỡ giao dịch khỏi ví này, không hủy được giao dịch đã lên mạng.">
          <Row icon="arrow.clockwise" title="Phát lại" onPress={() => act(() => wallet.rebroadcast(c, id), 'Đã phát lại')} />
          <Row destructive title="Xóa khỏi ví" onPress={() => Alert.alert('Xóa giao dịch?', '', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa', style: 'destructive', onPress: () => act(() => wallet.remove(c, id), 'Đã xóa').then(() => router.back()) },
          ])} />
        </Section>
      )}
    </ScrollView>
  );
}
