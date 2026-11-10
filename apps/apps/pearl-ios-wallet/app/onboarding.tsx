import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolViewProps } from 'expo-symbols';
import { Button, C, haptic, Icon, Input, Logo, Section, Segmented } from '@/components/ui';
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
  const seedWords = seed.trim() ? seed.trim().split(/\s+/).length : 0;
  const short = !!pass && pass.length < 8;
  const mismatch = !!pass2 && pass !== pass2;

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
      contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 40, gap: 28 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 24 }}>
        <Logo size={96} />
        <Text accessibilityRole="header" style={{ color: C.label, fontSize: 34, fontWeight: '700' }}>Pearl Wallet</Text>
        <Text style={{ color: C.secondary, fontSize: 17, textAlign: 'center' }}>Khóa riêng nằm trên máy của bạn.</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Choice icon="plus.circle.fill" title="Tạo ví mới" on={!importing} onPress={() => setMode('new')} />
        <Choice icon="arrow.down.circle.fill" title="Khôi phục" on={importing} onPress={() => setMode('import')} />
      </View>

      <Section header="Mạng">
        <View style={{ padding: 8 }}>
          <Segmented value={network} onChange={setNetwork} options={[['mainnet', 'Mainnet'], ['testnet2', 'Testnet']]} />
        </View>
      </Section>

      {importing && (
        <Section header="12 từ khôi phục" footer={seedWords ? `${seedWords}/12 từ` : 'Cách nhau bằng dấu cách.'}>
          <Input multiline editable={!busy} accessibilityLabel="12 từ khôi phục" placeholder="word1 word2 word3 …" value={seed} onChangeText={setSeed} spellCheck={false} autoComplete="off" style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 13 }} />
        </Section>
      )}

      <Section header="Passphrase" footer={short ? 'Ít nhất 8 ký tự.' : mismatch ? 'Passphrase không khớp.' : 'Dùng để mở khóa ví khi gửi tiền.'}>
        <Input placeholder="Passphrase" secureTextEntry value={pass} onChangeText={setPass} textContentType="newPassword" returnKeyType="next" editable={!busy} />
        <Input placeholder="Nhập lại" secureTextEntry value={pass2} onChangeText={setPass2} textContentType="newPassword" returnKeyType="done" editable={!busy} />
      </Section>

      <Button title={importing ? 'Khôi phục ví' : 'Tạo ví'} icon={importing ? 'arrow.down.circle' : 'plus'} onPress={submit} busy={busy} disabled={!pass || !pass2 || (importing && !seed)} />
    </ScrollView>
  );
}

function Choice({ icon, title, on, onPress }: { icon: SymbolViewProps['name']; title: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={() => { if (!on) { haptic.tap(); onPress(); } }}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 10, paddingVertical: 20, borderRadius: 18, borderCurve: 'continuous', backgroundColor: on ? C.accentTint : C.group, borderWidth: 2, borderColor: on ? C.accent : 'transparent', opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={30} color={on ? C.accent : C.secondary} />
      <Text style={{ color: C.label, fontSize: 16, fontWeight: on ? '600' : '500' }}>{title}</Text>
    </Pressable>
  );
}
