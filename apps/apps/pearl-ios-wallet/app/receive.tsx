import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, C, haptic, Icon } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function Receive() {
  const { c } = useWallet();
  const [addr, setAddr] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const { setup } = useWallet();
  useEffect(() => {
    setFailed(false);
    wallet.addresses(c)
      .then(a => a[0] ?? wallet.newAddress(c))
      .then(setAddr, e => { setFailed(true); haptic.error(); Alert.alert('Lỗi', String(e.message)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(addr ?? '');
    } catch (e) {
      haptic.error();
      Alert.alert('Không sao chép được', String((e as Error).message));
      return;
    }
    haptic.success();
    setCopied(true);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 24, alignItems: 'center' }}>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={addr ? 'Mã QR địa chỉ nhận' : 'Đang tải địa chỉ'}
        style={{ backgroundColor: '#fff', padding: 18, borderRadius: 24, borderCurve: 'continuous', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}
      >
        {addr ? <QRCode value={addr} size={224} /> : failed ? <Icon name="exclamationmark.triangle" size={40} color={C.orange} /> : <ActivityIndicator />}
      </View>

      <View style={{ backgroundColor: C.group, borderRadius: 12, borderCurve: 'continuous', padding: 16, gap: 6, alignSelf: 'stretch' }}>
        <Text style={{ color: C.secondary, fontSize: 13 }}>Địa chỉ PRL</Text>
        <Text selectable style={{ color: C.label, fontSize: 15, fontFamily: 'Menlo', lineHeight: 22 }}>{addr ?? (failed ? 'Không tải được địa chỉ' : '…')}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Button style={{ flex: 1 }} kind="tinted" icon={copied ? 'checkmark' : 'doc.on.doc'} title={copied ? 'Đã chép' : 'Sao chép'} disabled={!addr} onPress={copy} />
        <Button style={{ flex: 1 }} icon="square.and.arrow.up" title="Chia sẻ" disabled={!addr} onPress={() => Share.share({ message: addr ?? '' }).catch(() => {})} />
      </View>

      {failed && <Button style={{ alignSelf: 'stretch' }} kind="tinted" icon="arrow.clockwise" title="Thử lại" onPress={() => setTries(n => n + 1)} />}

      <Text style={{ color: C.secondary, fontSize: 13, textAlign: 'center' }}>
        {setup?.network === 'testnet2' ? 'Testnet: chỉ gửi PRL testnet tới địa chỉ này.' : 'Chỉ gửi PRL tới địa chỉ này.'}
      </Text>
    </ScrollView>
  );
}
