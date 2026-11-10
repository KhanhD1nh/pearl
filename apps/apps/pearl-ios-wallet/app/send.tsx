import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, C, fmt, haptic, Icon, Input } from '@/components/ui';
import * as Passphrase from '@/lib/passphrase';
import { usePrefs } from '@/lib/prefs';
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
  // Face ID (Settings switch) + passphrase stored by an earlier send: scan instead of typing.
  const { prefs } = usePrefs();
  const [stored, setSaved] = useState<boolean>();
  useEffect(() => { Passphrase.hasSaved().then(setSaved); }, []);
  const saved = prefs && stored !== undefined ? prefs.faceId && stored : undefined;
  const fee = fees[level];
  const spendable = Math.max(0, (balance ?? 0) - fee);
  const amt = Number(amount.replace(',', '.'));
  const tooMuch = amt > spendable;
  const toTrim = to.trim();
  // Fixed-point text (never "1e-7"), trailing zeros trimmed.
  const plain = (n: number) => n.toFixed(8).replace(/\.?0+$/, '');
  // Digits plus one separator, max 8 decimals (PRL precision).
  const onAmount = (t: string) => { if (/^\d*[.,]?\d{0,8}$/.test(t)) setAmount(t); };

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
      const p = saved ? await Passphrase.read() : pass;
      if (p == null) {
        // Face ID cancelled, or Keychain item invalidated by a biometric change: ask to type it.
        setSaved(false);
        return;
      }
      try {
        await wallet.unlock(c, p);
      } catch (e) {
        if (saved) { await Passphrase.forget(); setSaved(false); } // changed elsewhere: stop reusing it
        throw e;
      }
      try {
        const txid = await wallet.send(c, to.trim(), amt, fee);
        if (!saved && prefs?.faceId) await Passphrase.save(p).catch(() => {}); // correct passphrase: next sends use Face ID
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
    fmt(amt) + ' PRL\ntới ' + toTrim + '\n\nPhí ' + fee + ' PRL/kB',
    [{ text: 'Hủy', style: 'cancel' }, { text: 'Gửi', style: 'destructive', onPress: submit }],
  );

  const card = { backgroundColor: C.group, borderRadius: 20, borderCurve: 'continuous' as const, overflow: 'hidden' as const };
  const label = { color: C.secondary, fontSize: 13, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginHorizontal: 4 };
  const ready = !!toTrim && amt > 0 && !tooMuch;

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {/* Recipient */}
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={label}>Gửi tới</Text>
        <View style={[card, { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person.crop.circle" size={20} />
          </View>
          <Input
            placeholder="Địa chỉ prl1…"
            value={to}
            onChangeText={setTo}
            multiline
            accessibilityLabel="Địa chỉ người nhận"
            style={{ flex: 1, fontFamily: 'Menlo', fontSize: 15, paddingHorizontal: 12 }}
          />
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={to ? 'Xóa địa chỉ' : 'Dán địa chỉ'}
            onPress={async () => { haptic.tap(); setTo(to ? '' : (await Clipboard.getStringAsync().catch(() => '')).trim()); }}
            style={{ paddingHorizontal: 14, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={to ? 'xmark.circle.fill' : 'doc.on.clipboard'} size={20} color={to ? C.tertiary : C.accent} />
          </Pressable>
        </View>
      </View>

      {/* Amount */}
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={label}>Số lượng</Text>
        <View style={[card, { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, gap: 6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
            <Input
              value={amount}
              onChangeText={onAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              accessibilityLabel="Số lượng PRL"
              style={{ fontSize: 48, fontWeight: '700', textAlign: 'center', color: tooMuch ? C.red : C.label, minWidth: 80, paddingHorizontal: 0, fontVariant: ['tabular-nums'] }}
            />
            <Text style={{ color: C.accent, fontSize: 22, fontWeight: '600' }}>PRL</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={{ color: tooMuch ? C.red : C.secondary, fontSize: 14, fontVariant: ['tabular-nums'] }}>
            {tooMuch ? 'Vượt số dư khả dụng' : 'Khả dụng ' + fmt(spendable) + ' PRL'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignSelf: 'stretch' }}>
            {[25, 50, 75, 100].map(p => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={p === 100 ? 'Gửi tối đa' : 'Gửi ' + p + '% số dư khả dụng'}
                onPress={() => { haptic.tap(); setAmount(plain(spendable * p / 100)); }}
                style={({ pressed }) => ({ flex: 1, backgroundColor: C.accentTint, borderRadius: 12, borderCurve: 'continuous', minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>{p === 100 ? 'Tối đa' : p + '%'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Fee */}
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={label}>Phí mạng</Text>
        <View style={card} accessibilityRole="radiogroup">
          {FEE_LEVELS.map(([k, icon, name, blocks], i) => {
            const on = level === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={name + ', ' + fees[k] + ' PRL mỗi kB'}
                onPress={() => { haptic.tap(); setLevel(k); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 56, backgroundColor: pressed ? C.elevated : 'transparent', borderTopWidth: i ? 0.5 : 0, borderTopColor: C.separator })}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: on ? C.accent : C.elevated, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} size={16} color={on ? C.onAccent : C.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.label, fontSize: 17, fontWeight: on ? '600' : '400' }}>{name}</Text>
                  <Text style={{ color: C.secondary, fontSize: 13 }}>Mục tiêu {blocks} khối</Text>
                </View>
                <Text style={{ color: C.secondary, fontSize: 14, fontVariant: ['tabular-nums'] }}>{fees[k]} PRL/kB</Text>
                <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={22} color={on ? C.accent : C.tertiary} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {saved === false && (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={label}>Passphrase</Text>
          <View style={card}>
            <Input placeholder="Passphrase ví" accessibilityLabel="Passphrase ví" secureTextEntry value={pass} onChangeText={setPass} textContentType="password" />
          </View>
        </View>
      )}

      {/* Summary */}
      {ready && (
        <View style={[card, { padding: 16, gap: 8 }]} accessible accessibilityLabel={'Tóm tắt: gửi ' + fmt(amt) + ' PRL, phí ' + fee + ' PRL mỗi kB'}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.secondary, fontSize: 15 }}>Gửi</Text>
            <Text style={{ color: C.label, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{fmt(amt)} PRL</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.secondary, fontSize: 15 }}>Phí</Text>
            <Text style={{ color: C.label, fontSize: 15, fontVariant: ['tabular-nums'] }}>{fee} PRL/kB</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.secondary, fontSize: 15 }}>Xác thực</Text>
            <Text style={{ color: C.label, fontSize: 15 }}>{saved ? 'Face ID' : 'Passphrase'}</Text>
          </View>
        </View>
      )}

      <Button icon={saved ? 'faceid' : 'paperplane.fill'} title="Gửi" onPress={confirm} busy={busy}
        disabled={saved === undefined || !toTrim || !(amt > 0) || tooMuch || (!saved && !pass)} />
    </ScrollView>
  );
}
