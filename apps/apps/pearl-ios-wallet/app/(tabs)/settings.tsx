import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native';
import { Button, C, haptic, Input, Row, Section } from '@/components/ui';
import * as Passphrase from '@/lib/passphrase';
import { authenticate, biometricReady, THEME_LABEL, usePrefs } from '@/lib/prefs';
import { useWallet } from '@/lib/wallet';
import { wallet } from '@/rpc';

export default function Settings() {
  const { c, setup, sync } = useWallet();
  const { prefs, set } = usePrefs();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState<boolean>();
  const [updateState, setUpdateState] = useState<'checking' | 'downloading' | null>(null);
  useEffect(() => { biometricReady().then(setBio); }, []);

  const checkUpdates = async () => {
    if (updateState) return;
    setUpdateState('checking');
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) return Alert.alert('Ứng dụng đã cập nhật');
      Alert.alert('Có bản cập nhật', 'Tải bản cập nhật? Đóng và mở lại ứng dụng để áp dụng.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Tải', onPress: async () => {
          setUpdateState('downloading');
          try { await Updates.fetchUpdateAsync(); Alert.alert('Đã tải', 'Đóng hoàn toàn và mở lại ứng dụng để áp dụng.'); }
          catch (e) { Alert.alert('Không cập nhật được', String((e as Error).message)); }
          finally { setUpdateState(null); }
        } },
      ]);
    } catch (e) { Alert.alert('Không kiểm tra được cập nhật', String((e as Error).message)); }
    finally { setUpdateState(null); }
  };

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
        <Row icon="doc.text" iconBg={C.secondary} title="Nhật ký" chevron onPress={() => router.push('/log')} />
      </Section>

      <Section header="Chung">
        <Row icon="circle.lefthalf.filled" iconBg={C.indigo} title="Giao diện" value={THEME_LABEL[prefs?.theme ?? 'dark']} chevron onPress={() => router.push('/appearance')} />
        <Row icon="arrow.down.circle" iconBg={C.blue} title={updateState === 'checking' ? 'Đang kiểm tra…' : updateState === 'downloading' ? 'Đang tải cập nhật…' : 'Kiểm tra cập nhật'} onPress={updateState ? undefined : checkUpdates}>
          {!!updateState && <ActivityIndicator color={C.accent} />}
        </Row>
        <Row icon="faceid" iconBg={C.green} title="Face ID">
          <Switch value={!!prefs?.faceId} onValueChange={toggleLogin} disabled={!bio} trackColor={{ true: C.green }} accessibilityLabel="Face ID" />
        </Row>
      </Section>

      <Section header="Đổi passphrase" footer={next && next.length < 8 ? 'Ít nhất 8 ký tự.' : undefined}>
        <Input placeholder="Passphrase hiện tại" secureTextEntry value={cur} onChangeText={setCur} textContentType="password" returnKeyType="next" editable={!busy} />
        <Input placeholder="Passphrase mới" secureTextEntry value={next} onChangeText={setNext} textContentType="newPassword" returnKeyType="done" editable={!busy} />
        <View style={{ padding: 12 }}>
          <Button kind="tinted" title="Đổi passphrase" busy={busy} disabled={!cur || next.length < 8} onPress={changePass} />
        </View>
      </Section>

      <Text style={{ color: C.tertiary, fontSize: 13, textAlign: 'center' }}>Pearl Wallet · oyster SPV nhúng</Text>
    </ScrollView>
  );
}
