import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, C, haptic, Input, Logo, Section, Segmented } from '@/components/ui';
import * as Oyster from '@/modules/oyster';
import { Network, oysterArgs, randomCred, Setup, useWallet } from '@/lib/wallet';

export default function Onboarding() {
  const { saveSetup } = useWallet();
  const [network, setNetwork] = useState<Network>('mainnet');
  const [mode, setMode] = useState<'new' | 'import'>('new');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const importing = mode === 'import';

  const submit = async () => {
    if (pass.length < 8) return Alert.alert('Passphrase quá ngắn', 'Dùng ít nhất 8 ký tự.');
    if (pass !== pass2) return Alert.alert('Passphrase không khớp');
    const words = seed.trim().toLowerCase().split(/\s+/).join(' ');
    if (importing && words.split(' ').length !== 12) return Alert.alert('Seed phải có 12 từ');
    setBusy(true);
    try {
      const st: Setup = { network, user: randomCred(), pass: randomCred() };
      // Bday for imports matches desktop (rescan from chain launch).
      const mnemonic = await Oyster.create(oysterArgs(st), importing
        ? { PrivatePassphrase: pass, Seed: words, Bday: '1724644369' }
        : { PrivatePassphrase: pass });
      haptic.success();
      if (!importing) {
        await new Promise<void>(r => Alert.alert(
          'Ghi lại 12 từ khôi phục',
          mnemonic + '\n\nĐây là cách duy nhất để lấy lại ví. Viết ra giấy, không chụp màn hình, không gửi cho ai.',
          [{ text: 'Tôi đã ghi lại', onPress: () => r() }],
        ));
      }
      await saveSetup(st);
    } catch (e) {
      haptic.error();
      Alert.alert('Không tạo được ví', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 32, paddingBottom: 40, gap: 24 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 16 }}>
        <Logo size={88} />
        <Text style={{ color: C.label, fontSize: 34, fontWeight: '700' }}>Pearl Wallet</Text>
        <Text style={{ color: C.secondary, fontSize: 17, textAlign: 'center' }}>Khóa riêng nằm trên máy.</Text>
      </View>

      <View style={{ gap: 12 }}>
        <Segmented value={mode} onChange={setMode} options={[['new', 'Tạo ví mới'], ['import', 'Khôi phục ví']]} />
        <Segmented value={network} onChange={setNetwork} options={[['mainnet', 'Mainnet'], ['testnet2', 'Testnet']]} />
      </View>

      {importing && (
        <Section header="12 từ khôi phục">
          <Input multiline placeholder="word1 word2 word3 …" value={seed} onChangeText={setSeed} spellCheck={false} autoComplete="off" style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 13 }} />
        </Section>
      )}

      <Section header="Passphrase">
        <Input placeholder="Passphrase" secureTextEntry value={pass} onChangeText={setPass} textContentType="newPassword" returnKeyType="next" />
        <Input placeholder="Nhập lại" secureTextEntry value={pass2} onChangeText={setPass2} textContentType="newPassword" returnKeyType="done" />
      </Section>

      <Button title={importing ? 'Khôi phục ví' : 'Tạo ví'} onPress={submit} busy={busy} disabled={!pass || !pass2 || (importing && !seed)} />
    </ScrollView>
  );
}
