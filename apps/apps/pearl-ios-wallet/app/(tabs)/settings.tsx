import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native';
import { Button, C, haptic, Icon, Input, Logo, Row, Section } from '@/components/ui';
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

  const net = setup?.network === 'testnet2' ? 'Testnet' : 'Mainnet';
  const peers = sync?.connections ?? 0;
  const [pwOpen, setPwOpen] = useState(false);
  const updateTitle = updateState === 'checking' ? 'Đang kiểm tra…' : updateState === 'downloading' ? 'Đang tải cập nhật…' : 'Kiểm tra cập nhật';

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 24 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Text accessibilityRole="header" style={{ color: C.label, fontSize: 34, fontWeight: '700', paddingTop: 8 }}>Cài đặt</Text>

      <View style={{ backgroundColor: C.group, borderRadius: 20, borderCurve: 'continuous', padding: 20, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Logo size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.label, fontSize: 22, fontWeight: '700' }}>Pearl Wallet</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${net}, ${peers > 0 ? 'đã kết nối' : 'chưa có peer'}`}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: peers > 0 ? C.green : C.orange }} />
              <Text style={{ color: C.secondary, fontSize: 15 }}>{net} · {peers > 0 ? 'Đã kết nối' : 'Chưa có peer'}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="Peer" value={String(peers)} />
          <Stat label="Block" value={(sync?.block_height ?? 0).toLocaleString()} />
        </View>
      </View>

      <Section header="Bảo mật" footer="Face ID dùng để mở ứng dụng và xác nhận khi gửi.">
        <Row icon="faceid" iconBg={C.green} title="Face ID">
          <Switch value={!!prefs?.faceId} onValueChange={toggleLogin} disabled={!bio} trackColor={{ true: C.green }} accessibilityLabel="Face ID" />
        </Row>
        <Row icon="key.fill" iconBg={C.orange} title="Đổi passphrase" chevron={!pwOpen} value={pwOpen ? <Icon name="chevron.up" size={14} color={C.tertiary} weight="semibold" /> : undefined} onPress={() => { haptic.tap(); setPwOpen(o => !o); }} />
        {pwOpen && (
          <View>
            <Input placeholder="Passphrase hiện tại" secureTextEntry value={cur} onChangeText={setCur} textContentType="password" returnKeyType="next" editable={!busy} />
            <View style={{ height: 0.5, backgroundColor: C.separator, marginLeft: 16 }} />
            <Input placeholder="Passphrase mới (ít nhất 8 ký tự)" secureTextEntry value={next} onChangeText={setNext} textContentType="newPassword" returnKeyType="done" editable={!busy} />
            <View style={{ padding: 12 }}>
              <Button kind="tinted" title="Đổi passphrase" busy={busy} disabled={!cur || next.length < 8} onPress={changePass} />
            </View>
          </View>
        )}
      </Section>

      <Section header="Ứng dụng">
        <Row icon="circle.lefthalf.filled" iconBg={C.indigo} title="Giao diện" value={THEME_LABEL[prefs?.theme ?? 'dark']} chevron onPress={() => router.push('/appearance')} />
        <Row icon="arrow.down.circle" iconBg={C.blue} title={updateTitle} onPress={updateState ? undefined : checkUpdates}>
          {!!updateState && <ActivityIndicator color={C.accent} />}
        </Row>
        <Row icon="doc.text" iconBg={C.secondary} title="Nhật ký" chevron onPress={() => router.push('/log')} />
      </Section>

      <Text style={{ color: C.tertiary, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 }}>
        Muốn đổi mạng hoặc dùng ví khác: xóa app rồi cài lại, sau đó khôi phục bằng 12 từ.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, backgroundColor: C.elevated, borderRadius: 14, borderCurve: 'continuous', padding: 14, gap: 2 }}>
      <Text style={{ color: C.secondary, fontSize: 13 }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: C.label, fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
