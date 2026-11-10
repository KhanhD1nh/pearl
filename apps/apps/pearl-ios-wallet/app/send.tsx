import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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

  const card = { backgroundColor: C.group, borderRadius: 24, borderCurve: 'continuous' as const, overflow: 'hidden' as const };
  const label = { color: C.secondary, fontSize: 13, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginHorizontal: 4 };
  const ready = !!toTrim && amt > 0 && !tooMuch;
  const testnet = setup?.network === 'testnet2';

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {/* Amount hero: same dark-green gradient card as the home balance */}
      <View style={{ backgroundColor: '#192c25', borderRadius: 28, borderCurve: 'continuous', padding: 22, gap: 14, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="send" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#304c3d" /><Stop offset="1" stopColor="#101c19" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#send)" />
            <Circle cx="100%" cy="0" r="120" fill="#cfe98a" opacity={0.07} />
            <Circle cx="100%" cy="0" r="78" fill="#cfe98a" opacity={0.06} />
          </Svg>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#cfe98a', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow.up" size={16} color="#0b0d08" weight="bold" />
          </View>
          <Text style={{ color: '#d8e6d7', fontSize: 15, fontWeight: '600', flex: 1 }}>GỬI PRL</Text>
          {testnet && (
            <Text style={{ color: C.orange, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: C.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>TESTNET</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Input
            value={amount}
            onChangeText={onAmount}
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.35)"
            selectionColor="#cfe98a"
            keyboardType="decimal-pad"
            accessibilityLabel="Số lượng PRL"
            style={{ flexShrink: 1, fontSize: 52, fontWeight: '700', textAlign: 'center', color: tooMuch ? '#ff8a80' : '#ffffff', minWidth: 80, paddingHorizontal: 0, fontVariant: ['tabular-nums'], letterSpacing: -1 }}
          />
          <Text style={{ color: '#cfe98a', fontSize: 22, fontWeight: '700' }}>PRL</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={{ color: tooMuch ? '#ff8a80' : '#d0dbce', fontSize: 15, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {tooMuch ? 'Vượt số dư khả dụng' : 'Khả dụng ' + fmt(spendable) + ' PRL'}
        </Text>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[25, 50, 75, 100].map(p => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={p === 100 ? 'Gửi tối đa' : 'Gửi ' + p + '% số dư khả dụng'}
              onPress={() => { haptic.tap(); setAmount(plain(spendable * p / 100)); }}
              style={({ pressed }) => ({ flex: 1, backgroundColor: p === 100 ? '#cfe98a' : 'rgba(255,255,255,0.14)', borderRadius: 999, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: p === 100 ? '#0b0d08' : '#ffffff', fontSize: 14, fontWeight: '700' }}>{p === 100 ? 'Tối đa' : p + '%'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Recipient */}
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={label}>Gửi tới</Text>
        <View style={[card, { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person.crop.circle" size={22} />
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

      {/* Fee: three tiles */}
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={label}>Phí mạng</Text>
        <View style={{ flexDirection: 'row', gap: 10 }} accessibilityRole="radiogroup">
          {FEE_LEVELS.map(([k, icon, name]) => {
            const on = level === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={name + ', ' + fees[k] + ' PRL mỗi kB'}
                onPress={() => { haptic.tap(); setLevel(k); }}
                style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6, minHeight: 88, borderRadius: 20, borderCurve: 'continuous', backgroundColor: on ? C.accentTint : C.group, borderWidth: 2, borderColor: on ? C.accent : 'transparent', opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name={icon} size={20} color={on ? C.accent : C.secondary} />
                <Text style={{ color: C.label, fontSize: 16, fontWeight: on ? '700' : '500' }}>{name}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: C.secondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>{fees[k]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: C.secondary, fontSize: 13, marginHorizontal: 4, fontVariant: ['tabular-nums'] }}>
          PRL/kB · mục tiêu {FEE_LEVELS.find(f => f[0] === level)![3]} khối
        </Text>
      </View>

      {saved === false && (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={label}>Passphrase</Text>
          <View style={[card, { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }]}>
            <Icon name="lock.fill" size={20} />
            <Input style={{ flex: 1 }} placeholder="Passphrase ví" accessibilityLabel="Passphrase ví" secureTextEntry value={pass} onChangeText={setPass} textContentType="password" />
          </View>
        </View>
      )}

      {/* Summary */}
      {ready && (
        <View style={[card, { padding: 16, gap: 10 }]} accessible accessibilityLabel={'Tóm tắt: gửi ' + fmt(amt) + ' PRL, phí ' + fee + ' PRL mỗi kB'}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.secondary, fontSize: 15 }}>Gửi</Text>
            <Text style={{ color: C.label, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{fmt(amt)} PRL</Text>
          </View>
          <View style={{ height: 0.5, backgroundColor: C.separator }} />
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
