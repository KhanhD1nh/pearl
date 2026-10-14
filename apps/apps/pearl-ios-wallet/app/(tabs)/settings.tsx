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
      if (prefs?.faceIdSend) await set({ faceIdSend: false });
      haptic.success();
      Alert.alert('Đã đổi passphrase', prefs?.faceIdSend ? 'Bật lại "Gửi bằng Face ID" để dùng passphrase mới.' : undefined);
      setCur(''); setNext('');
    } catch (e) {
      haptic.error();
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const toggleLogin = async (on: boolean) => {
    if (!(await authenticate(on ? 'Bật mở khóa bằng Face ID' : 'Tắt mở khóa bằng Face ID'))) return;
    await set({ faceIdLogin: on });
  };

  // Turning on asks for the passphrase once, checks it against the wallet, then stores it behind Face ID.
  const toggleSend = (on: boolean) => {
    if (!on) {
      Passphrase.forget().then(() => set({ faceIdSend: false }));
      return;
    }
    Alert.prompt('Gửi bằng Face ID', 'Nhập passphrase ví một lần để lưu vào Keychain, khóa bằng Face ID.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bật',
        onPress: async (p?: string) => {
          try {
            await wallet.unlock(c, p ?? '');
            await wallet.lock(c).catch(() => {});
            await Passphrase.save(p ?? '');
            await set({ faceIdSend: true });
            haptic.success();
          } catch (e) {
            haptic.error();
            Alert.alert('Không bật được', String((e as Error).message).includes('passphrase') ? 'Sai passphrase.' : String((e as Error).message));
          }
        },
      },
    ], 'secure-text');
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
            options={[['dark', 'Tối'], ['system', 'Theo hệ thống']]}
            onChange={theme => set({ theme })}
          />
        </View>
      </Section>

      <Section header="Bảo mật" footer={bio === false ? 'Máy chưa cài Face ID / Touch ID.' : 'Gửi bằng Face ID lưu passphrase trong Keychain của máy này, chỉ mở được bằng khuôn mặt của bạn.'}>
        <Row icon="faceid" iconBg={C.green} title="Mở khóa app">
          <Switch value={!!prefs?.faceIdLogin} onValueChange={toggleLogin} disabled={!bio} trackColor={{ true: C.green }} />
        </Row>
        <Row icon="paperplane.fill" iconBg={C.blue} title="Gửi bằng Face ID">
          <Switch value={!!prefs?.faceIdSend} onValueChange={toggleSend} disabled={!bio} trackColor={{ true: C.green }} />
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
