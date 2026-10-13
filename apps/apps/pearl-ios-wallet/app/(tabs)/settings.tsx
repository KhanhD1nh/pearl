import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, C, haptic, Input, Row, Section } from '@/components/ui';
import * as Passphrase from '@/lib/passphrase';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function Settings() {
  const { c, setup, sync, load } = useWallet();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [wif, setWif] = useState('');
  const [busy, setBusy] = useState<'pass' | 'wif'>();

  const run = async (k: 'pass' | 'wif', f: () => Promise<unknown>, ok: string) => {
    setBusy(k);
    try {
      await f();
      haptic.success();
      Alert.alert(ok);
      setCur(''); setNext(''); setWif('');
      load();
    } catch (e) {
      haptic.error();
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setBusy(undefined);
    }
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
        <Row icon="network" iconBg="#0a84ff" title="Mạng" value={setup?.network === 'testnet2' ? 'Testnet' : 'Mainnet'} />
        <Row icon="antenna.radiowaves.left.and.right" iconBg={C.green} title="Peer" value={String(sync?.connections ?? 0)} />
        <Row icon="square.stack.3d.up" iconBg="#5e5ce6" title="Block" value={(sync?.block_height ?? 0).toLocaleString()} />
      </Section>

      <Section header="Đổi passphrase">
        <Input placeholder="Passphrase hiện tại" secureTextEntry value={cur} onChangeText={setCur} />
        <Input placeholder="Passphrase mới" secureTextEntry value={next} onChangeText={setNext} textContentType="newPassword" />
        <View style={{ padding: 12 }}>
          <Button kind="tinted" title="Đổi passphrase" busy={busy === 'pass'} disabled={!cur || next.length < 8}
            onPress={() => run('pass', async () => { await wallet.changePass(c, cur, next); await Passphrase.forget(); }, 'Đã đổi passphrase')} />
        </View>
      </Section>

      <Section header="Nhập private key" footer="Cần passphrase hiện tại. Ví sẽ quét lại chuỗi để tìm giao dịch của key này.">
        <Input placeholder="Private key (WIF)" secureTextEntry value={wif} onChangeText={setWif} />
        <Input placeholder="Passphrase hiện tại" secureTextEntry value={cur} onChangeText={setCur} />
        <View style={{ padding: 12 }}>
          <Button kind="tinted" title="Nhập key" busy={busy === 'wif'} disabled={!wif || !cur}
            onPress={() => run('wif', async () => {
              await wallet.unlock(c, cur);
              try { await wallet.importKey(c, wif.trim()); } finally { await wallet.lock(c).catch(() => {}); }
            }, 'Đã nhập key, đang quét lại')} />
        </View>
      </Section>

      <Text style={{ color: C.tertiary, fontSize: 13, textAlign: 'center' }}>Pearl Wallet · oyster SPV nhúng</Text>
    </ScrollView>
  );
}
