import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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

      <View style={{ backgroundColor: '#192c25', borderRadius: 28, borderCurve: 'continuous', padding: 22, gap: 18, overflow: 'hidden', alignItems: 'center' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="recv" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#304c3d" /><Stop offset="1" stopColor="#101c19" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#recv)" />
            <Circle cx="100%" cy="0" r="120" fill="#cfe98a" opacity={0.07} />
            <Circle cx="100%" cy="0" r="78" fill="#cfe98a" opacity={0.06} />
          </Svg>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#cfe98a', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow.down" size={16} color="#0b0d08" weight="bold" />
          </View>
          <Text style={{ color: '#d8e6d7', fontSize: 15, fontWeight: '600', flex: 1 }}>NHẬN PRL</Text>
          {net === 'Testnet' && (
            <Text style={{ color: C.orange, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: C.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>TESTNET</Text>
          )}
        </View>

        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={addr ? 'Mã QR địa chỉ nhận' : 'Đang tải địa chỉ'}
          style={{ backgroundColor: '#fff', padding: 16, borderRadius: 24, borderCurve: 'continuous', width: 248, height: 248, alignItems: 'center', justifyContent: 'center' }}
        >
          {addr ? <QRCode value={addr} size={216} /> : failed ? <Icon name="exclamationmark.triangle" size={40} color={C.orange} /> : <ActivityIndicator />}
        </View>

        <View style={{ alignSelf: 'stretch', gap: 6, alignItems: 'center' }}>
          <Text style={{ color: '#d0dbce', fontSize: 13 }}>Địa chỉ của bạn</Text>
          <Text
            selectable
            accessibilityLabel={addr ?? undefined}
            style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Menlo', lineHeight: 26, textAlign: 'center' }}
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

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.accentTint, borderRadius: 16, borderCurve: 'continuous', padding: 14 }}>
        <Icon name="info.circle.fill" size={18} />
        <Text style={{ flex: 1, color: C.label, fontSize: 14 }}>
          {setup?.network === 'testnet2' ? 'Testnet: chỉ gửi PRL testnet tới địa chỉ này.' : 'Chỉ gửi PRL tới địa chỉ này.'}
        </Text>
      </View>
    </ScrollView>
  );
}
