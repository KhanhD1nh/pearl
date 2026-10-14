import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { Button, C, haptic, Input, Row, Section, Segmented } from '@/components/ui';
import * as Passphrase from '@/lib/passphrase';
import { authenticate, biometricReady, Theme, usePrefs } from '@/lib/prefs';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function Settings() {
  const { c, setup, sync } = useWallet();
  const { prefs, set } = usePrefs();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState<boolean>();
  useEffect(() => { biometricReady().then(setBio); }, []);

  const changePass = async () => {
    setBusy(true);
    try {
      await wallet.changePass(c, cur, next);
      await Passphrase.forget();
      haptic.success();
      Alert.alert('Đã đổi passphrase');
      setCur(''); setNext('');
    } catch (e) {
      haptic.error();
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const toggleLogin = async (on: boolean) => {
    if (!(await authenticate(on ? 'Bật Face ID' : 'Tắt Face ID'))) return;
    await set({ faceId: on });
    if (!on) await Passphrase.forget();
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 28 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={{ color: C.label, fontSize: 34, fontWeight: '700', paddingTop: 8 }}>Cài đặt</Text>

      <Section header="Ví" footer="Muốn đổi mạng hoặc dùng ví khác: xóa app rồi cài lại, sau đó khôi phục bằng 12 từ.">
        <Row icon="network" iconBg={C.blue} title="Mạng" value={setup?.network === 'testnet2' ? 'Testnet' : 'Mainnet'} />
        <Row icon="antenna.radiowaves.left.and.right" iconBg={C.green} title="Peer" value={String(sync?.connections ?? 0)} />
        <Row icon="square.stack.3d.up" iconBg={C.indigo} title="Block" value={(sync?.block_height ?? 0).toLocaleString()} />
      </Section>

      <Section header="Giao diện">
        <View style={{ padding: 12 }}>
          <Segmented<Theme>
            value={prefs?.theme ?? 'dark'}
            options={[['light', 'Sáng'], ['dark', 'Tối'], ['system', 'Hệ thống']]}
            onChange={theme => set({ theme })}
          />
        </View>
      </Section>

      <Section header="Bảo mật" footer={bio === false ? 'Máy chưa cài Face ID / Touch ID.' : undefined}>
        <Row icon="faceid" iconBg={C.green} title="Face ID">
          <Switch value={!!prefs?.faceId} onValueChange={toggleLogin} disabled={!bio} trackColor={{ true: C.green }} />
        </Row>
      </Section>

      <Section header="Đổi passphrase">
        <Input placeholder="Passphrase hiện tại" secureTextEntry value={cur} onChangeText={setCur} />
        <Input placeholder="Passphrase mới" secureTextEntry value={next} onChangeText={setNext} textContentType="newPassword" />
        <View style={{ padding: 12 }}>
          <Button kind="tinted" title="Đổi passphrase" busy={busy} disabled={!cur || next.length < 8} onPress={changePass} />
        </View>
      </Section>

      <Text style={{ color: C.tertiary, fontSize: 13, textAlign: 'center' }}>Pearl Wallet · oyster SPV nhúng</Text>
    </ScrollView>
  );
}
