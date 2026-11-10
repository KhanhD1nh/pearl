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

  const net = setup?.network === 'testnet2' ? 'Testnet' : 'Mainnet';
  // Address in 4-char groups for reading aloud / visual check; copy/share still use the raw string.
  const groups = addr ? addr.match(/.{1,4}/g)!.join(' ') : undefined;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}>

      <View style={{ backgroundColor: C.group, borderRadius: 28, borderCurve: 'continuous', padding: 20, alignItems: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentTint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Icon name="arrow.down.circle.fill" size={15} />
          <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Nhận PRL · {net}</Text>
        </View>

        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={addr ? 'Mã QR địa chỉ nhận' : 'Đang tải địa chỉ'}
          style={{ backgroundColor: '#fff', padding: 16, borderRadius: 20, borderCurve: 'continuous', width: 248, height: 248, alignItems: 'center', justifyContent: 'center' }}
        >
          {addr ? <QRCode value={addr} size={216} /> : failed ? <Icon name="exclamationmark.triangle" size={40} color={C.orange} /> : <ActivityIndicator />}
        </View>

        <View style={{ alignSelf: 'stretch', gap: 6, alignItems: 'center' }}>
          <Text style={{ color: C.secondary, fontSize: 13 }}>Địa chỉ của bạn</Text>
          <Text
            selectable
            accessibilityLabel={addr ?? undefined}
            style={{ color: C.label, fontSize: 15, fontFamily: 'Menlo', lineHeight: 24, textAlign: 'center' }}
          >
            {groups ?? (failed ? 'Không tải được địa chỉ' : '…')}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button style={{ flex: 1 }} kind="tinted" icon={copied ? 'checkmark' : 'doc.on.doc'} title={copied ? 'Đã chép' : 'Sao chép'} disabled={!addr} onPress={copy} />
        <Button style={{ flex: 1 }} icon="square.and.arrow.up" title="Chia sẻ" disabled={!addr} onPress={() => Share.share({ message: addr ?? '' }).catch(() => {})} />
      </View>

      {failed && <Button kind="tinted" icon="arrow.clockwise" title="Thử lại" onPress={() => setTries(n => n + 1)} />}

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4 }}>
        <Icon name="info.circle" size={16} color={C.secondary} />
        <Text style={{ flex: 1, color: C.secondary, fontSize: 13 }}>
          {setup?.network === 'testnet2' ? 'Testnet: chỉ gửi PRL testnet tới địa chỉ này.' : 'Chỉ gửi PRL tới địa chỉ này.'}
        </Text>
      </View>
    </ScrollView>
  );
}
