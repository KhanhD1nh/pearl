import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, C, fmt, haptic, Icon, Input, Section } from '@/components/ui';
import { useWallet } from '@/lib/wallet';
import { wallet, RpcError } from '@/rpc';

type FeeLevel = 'fast' | 'medium' | 'slow';
// Same as desktop SendTransaction.tsx / blockbook-client.ts.
const FEE_LEVELS: [FeeLevel, 'bolt.fill' | 'clock' | 'tortoise', string, number][] = [
  ['fast', 'bolt.fill', 'Nhanh', 1], ['medium', 'clock', 'Vừa', 10], ['slow', 'tortoise', 'Chậm', 25],
];
const MEMPOOL_MIN_FEE = 0.00001;
const BLOCKBOOK = { mainnet: 'http://blockbook.pearlresearch.ai', testnet2: 'http://blockbook.testnet.pearlresearch.ai' };

export default function Send() {
  const { c, balance, setup, load } = useWallet();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [level, setLevel] = useState<FeeLevel>('fast');
  const [fees, setFees] = useState<Record<FeeLevel, number>>({ fast: 0.0001, medium: 0.00005, slow: 0.00001 });
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const fee = fees[level];
  const spendable = Math.max(0, (balance ?? 0) - fee);
  const amt = Number(amount.replace(',', '.'));
  const tooMuch = amt > spendable;

  useEffect(() => {
    const net = setup?.network ?? 'mainnet';
    Promise.all(FEE_LEVELS.map(([, , , n]) =>
      fetch(BLOCKBOOK[net] + '/api/v1/estimatefee/' + n).then(r => r.json()).then(d => Math.max(Number(d.result) || 0, MEMPOOL_MIN_FEE)),
    )).then(([fast, medium, slow]) => setFees({ fast, medium, slow })).catch(() => {});
  }, [setup?.network]);

  const submit = async () => {
    setBusy(true);
    try {
      if (!(await wallet.validate(c, to.trim()))) throw new Error('Địa chỉ không hợp lệ');
      await wallet.unlock(c, pass);
      try {
        const txid = await wallet.send(c, to.trim(), amt, fee);
        haptic.success();
        load();
        router.back();
        Alert.alert('Đã tạo giao dịch', 'Giao dịch đang chờ xác nhận.\n\n' + txid);
      } finally {
        await wallet.lock(c).catch(() => {});
      }
    } catch (e) {
      haptic.error();
      const m = String((e as Error).message);
      // -9: oyster preflight failed before signing (pearl-wallet v3 sendTxError); message text is not stable.
      Alert.alert('Gửi thất bại', (e as RpcError).code === -9
        ? 'Không có peer nào kết nối. Chưa ký, chưa gửi gì, tiền vẫn còn. Kiểm tra kết nối rồi thử lại.'
        : m.includes('mempool min fee not met') ? 'Phí quá thấp. Thử giao dịch nhỏ hơn.'
        : m.includes('passphrase') ? 'Sai passphrase.' : m);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => Alert.alert(
    'Xác nhận gửi',
    fmt(amt) + ' PRL\ntới ' + to.trim() + '\n\nPhí ' + fee + ' PRL/kB',
    [{ text: 'Hủy', style: 'cancel' }, { text: 'Gửi', style: 'destructive', onPress: submit }],
  );

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 24 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {/* Amount hero */}
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Input
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType="decimal-pad"
            style={{ fontSize: 52, fontWeight: '700', textAlign: 'center', color: tooMuch ? C.red : C.label, minWidth: 80, paddingHorizontal: 0, fontVariant: ['tabular-nums'] }}
          />
          <Text style={{ color: C.accent, fontSize: 24, fontWeight: '600' }}>PRL</Text>
        </View>
        <Text style={{ color: tooMuch ? C.red : C.secondary, fontSize: 14 }}>
          {tooMuch ? 'Vượt số dư khả dụng' : 'Khả dụng ' + fmt(spendable) + ' PRL'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[25, 50, 75, 100].map(p => (
            <Pressable
              key={p}
              onPress={() => { haptic.tap(); setAmount(String(Number((spendable * p / 100).toFixed(8)))); }}
              style={({ pressed }) => ({ backgroundColor: C.group, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: C.label, fontSize: 14, fontWeight: '600' }}>{p === 100 ? 'Tối đa' : p + '%'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Section header="Người nhận">
        <Input placeholder="Địa chỉ prl1…" value={to} onChangeText={setTo} style={{ fontFamily: 'Menlo', fontSize: 15 }} />
      </Section>

      <Section header="Phí mạng" footer={'Phí ' + fee + ' PRL / kB'}>
        <View style={{ flexDirection: 'row', padding: 8, gap: 8 }}>
          {FEE_LEVELS.map(([k, icon, name, n]) => {
            const on = level === k;
            return (
              <Pressable
                key={k}
                onPress={() => { haptic.tap(); setLevel(k); }}
                style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 10, borderCurve: 'continuous', backgroundColor: on ? 'rgba(207,233,138,0.15)' : 'transparent', borderWidth: 1, borderColor: on ? C.accent : 'transparent' }}
              >
                <Icon name={icon} size={18} color={on ? C.accent : C.secondary} />
                <Text style={{ color: on ? C.accent : C.label, fontSize: 15, fontWeight: '600' }}>{name}</Text>
                <Text style={{ color: C.secondary, fontSize: 12 }}>~{n} block</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section header="Xác thực">
        <Input placeholder="Passphrase ví" secureTextEntry value={pass} onChangeText={setPass} textContentType="password" />
      </Section>

      <Button icon="paperplane.fill" title="Gửi" onPress={confirm} busy={busy} disabled={!to || !(amt > 0) || tooMuch || !pass} />
    </ScrollView>
  );
}
