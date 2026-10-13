import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, C, haptic } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function Receive() {
  const { c } = useWallet();
  const [addr, setAddr] = useState<string>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    wallet.addresses(c)
      .then(a => a[0] ?? wallet.newAddress(c))
      .then(setAddr, e => Alert.alert('Lỗi', String(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(addr ?? '');
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 24, alignItems: 'center' }}>
      <Text style={{ color: C.secondary, fontSize: 15, textAlign: 'center' }}>Quét mã hoặc gửi địa chỉ này cho người gửi.</Text>

      <View style={{ backgroundColor: '#fff', padding: 18, borderRadius: 24, borderCurve: 'continuous', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}>
        {addr ? <QRCode value={addr} size={224} /> : <ActivityIndicator />}
      </View>

      <View style={{ backgroundColor: C.group, borderRadius: 12, borderCurve: 'continuous', padding: 16, gap: 6, alignSelf: 'stretch' }}>
        <Text style={{ color: C.secondary, fontSize: 13 }}>Địa chỉ PRL</Text>
        <Text selectable style={{ color: C.label, fontSize: 15, fontFamily: 'Menlo', lineHeight: 22 }}>{addr ?? '…'}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Button style={{ flex: 1 }} kind="tinted" icon={copied ? 'checkmark' : 'doc.on.doc'} title={copied ? 'Đã chép' : 'Sao chép'} disabled={!addr} onPress={copy} />
        <Button style={{ flex: 1 }} icon="square.and.arrow.up" title="Chia sẻ" disabled={!addr} onPress={() => Share.share({ message: addr ?? '' })} />
      </View>

      <Text style={{ color: C.tertiary, fontSize: 13, textAlign: 'center' }}>Chỉ gửi PRL tới địa chỉ này. Tiền nhận được sẽ hiện sau khi có xác nhận.</Text>
    </ScrollView>
  );
}
