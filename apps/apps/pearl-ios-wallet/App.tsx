import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import * as Oyster from './modules/oyster';
import { Conn, Sync, Tx, wallet } from './rpc';

// Embedded oyster, same flags as desktop wallet-process.ts getWalletArgs().
type Setup = { network: 'mainnet' | 'testnet2'; user: string; pass: string };
const KEY = 'pearl-setup';
const PORT = 8335;
const conn = (s: Setup): Conn => ({ url: `http://127.0.0.1:${PORT}`, user: s.user, pass: s.pass });
const args = (s: Setup) => [
  '--usespv', `--appdata=${Oyster.dataDir()}`, `--logdir=${Oyster.dataDir()}/logs`, `--username=${s.user}`, `--password=${s.pass}`,
  `--rpclisten=127.0.0.1:${PORT}`, '--noservertls', ...(s.network === 'testnet2' ? ['--testnet2'] : []),
];
// ponytail: Math.random creds; RPC only listens on 127.0.0.1 inside the app. Use expo-crypto if exposed further.
const rnd = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export default function App() {
  const [setup, setSetup] = useState<Setup | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Keychain survives app deletion but Documents (wallet.db) does not: drop stale setup.
    SecureStore.getItemAsync(KEY).then(async v => {
      const st: Setup | null = v ? JSON.parse(v) : null;
      if (st && !Oyster.walletExists(st.network)) {
        await SecureStore.deleteItemAsync(KEY);
        return setSetup(null);
      }
      setSetup(st);
    });
  }, []);

  useEffect(() => {
    if (!setup) return;
    try {
      Oyster.start(args(setup));
    } catch (e) {
      return Alert.alert('Không khởi động được ví', String((e as Error).message));
    }
    const t = setInterval(async () => {
      try {
        Oyster.status();
        await wallet.balance(conn(setup));
        setReady(true);
        clearInterval(t);
      } catch (e) {
        if (!String((e as Error).message).includes('Network request failed')) {
          clearInterval(t);
          Alert.alert('Ví dừng', String((e as Error).message));
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [setup]);

  let body;
  if (setup === undefined) body = <ActivityIndicator color={C.primary} />;
  else if (!setup) body = <Onboard onDone={async s => { await SecureStore.setItemAsync(KEY, JSON.stringify(s)); setSetup(s); }} />;
  else if (!ready) body = <View style={s.center}><Logo /><ActivityIndicator color={C.primary} /><Text style={s.muted}>Đang khởi động ví…</Text></View>;
  else body = <Wallet c={conn(setup)} network={setup.network} />;
  return (
    <SafeAreaView style={s.fill}>
      {body}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

// Colors from pearl-desktop-wallet renderer/src/assets/index.css (.dark).
const C = {
  bg: '#202525', card: '#313939', line: '#3c4343', fg: '#f2f4f0', muted: '#9aa3a3',
  primary: '#cfe98a', accent: '#8fd3da', red: '#ff7a7a', green: '#cfe98a',
};

function Logo() {
  return (
    <View style={s.logo}>
      <Text style={s.logoText}>P</Text>
    </View>
  );
}

function Btn({ title, onPress, kind = 'primary', disabled, busy }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean;
}) {
  const fg = kind === 'primary' ? '#000' : kind === 'danger' ? C.red : C.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.btn, kind === 'primary' ? s.btnPrimary : s.btnGhost, (disabled || pressed) && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

function Segment<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[s.segItem, value === v && s.segActive]}>
          <Text style={[s.segText, value === v && { color: '#000' }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} {...p} style={[s.in, p.style]} />
    </View>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={12}><Text style={s.back}>‹ Quay lại</Text></Pressable>
      <Text style={s.h1}>{title}</Text>
    </View>
  );
}

function Onboard({ onDone }: { onDone: (s: Setup) => Promise<void> }) {
  const [network, setNetwork] = useState<Setup['network']>('mainnet');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<'new' | 'import'>('new');
  const [busy, setBusy] = useState(false);
  const importing = mode === 'import';

  const submit = async () => {
    if (!pass || pass !== pass2) return Alert.alert('Passphrase trống hoặc không khớp');
    const words = seed.trim().toLowerCase().split(/\s+/).join(' ');
    if (importing && words.split(' ').length !== 12) return Alert.alert('Seed phải có 12 từ');
    setBusy(true);
    try {
      const st: Setup = { network, user: rnd(), pass: rnd() };
      // Bday for imports matches desktop (rescan from chain launch).
      const mnemonic = await Oyster.create(args(st), importing
        ? { PrivatePassphrase: pass, Seed: words, Bday: '1724644369' }
        : { PrivatePassphrase: pass });
      if (!importing) {
        await new Promise<void>(r => Alert.alert('Ghi lại seed (12 từ)', `${mnemonic}\n\nMất seed là mất tiền. Không chia sẻ cho ai.`, [{ text: 'Đã ghi', onPress: () => r() }]));
      }
      await onDone(st);
    } catch (e) {
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <View style={s.hero}>
        <Logo />
        <Text style={s.title}>Pearl Wallet</Text>
        <Text style={s.muted}>Ví SPV chạy ngay trên iPhone. Khóa không rời máy.</Text>
      </View>
      <Segment value={network} onChange={setNetwork} options={[['mainnet', 'Mainnet'], ['testnet2', 'Testnet']]} />
      <Segment value={mode} onChange={setMode} options={[['new', 'Tạo ví mới'], ['import', 'Khôi phục']]} />
      <View style={s.card}>
        {importing && (
          <Field label="Seed (12 từ)" multiline placeholder="word1 word2 …" value={seed} onChangeText={setSeed} style={{ minHeight: 90, textAlignVertical: 'top' }} />
        )}
        <Field label="Passphrase" placeholder="••••••••" secureTextEntry value={pass} onChangeText={setPass} />
        <Field label="Nhập lại passphrase" placeholder="••••••••" secureTextEntry value={pass2} onChangeText={setPass2} />
      </View>
      <Btn title={importing ? 'Khôi phục ví' : 'Tạo ví'} onPress={submit} busy={busy} />
    </ScrollView>
  );
}

type Screen = 'home' | 'send' | 'settings';

function Wallet({ c, network }: { c: Conn; network: Setup['network'] }) {
  const [balance, setBalance] = useState<number>();
  const [sync, setSync] = useState<Sync>();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, t, y] = await Promise.all([wallet.balance(c), wallet.txs(c), wallet.sync(c)]);
      setBalance(b);
      setSync(y);
      setTxs([...t].sort((a, z) => z.time - a.time));
    } catch (e) {
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [c]);
  useEffect(() => {
    load();
    const t = setInterval(() => wallet.sync(c).then(setSync).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [load, c]);

  const receive = async () => {
    try {
      const addr = (await wallet.addresses(c))[0] ?? (await wallet.newAddress(c));
      // ponytail: share sheet instead of QR; add react-native-qrcode-svg if users need scanning.
      await Share.share({ message: addr });
    } catch (e) {
      Alert.alert('Lỗi', String((e as Error).message));
    }
  };

  const txMenu = (t: Tx) => {
    const run = (f: () => Promise<unknown>) => f().then(load).catch(e => Alert.alert('Lỗi', String(e.message)));
    Alert.alert('Giao dịch', t.txid, [
      { text: 'Sao chép / chia sẻ', onPress: () => Share.share({ message: t.txid }) },
      ...(t.confirmations === 0 ? [
        { text: 'Phát lại', onPress: () => run(() => wallet.rebroadcast(c, t.txid)) },
        { text: 'Xóa', style: 'destructive' as const, onPress: () => run(() => wallet.remove(c, t.txid)) },
      ] : []),
      { text: 'Đóng', style: 'cancel' },
    ]);
  };

  if (screen === 'send') return <Send c={c} balance={balance} onDone={() => { setScreen('home'); load(); }} />;
  if (screen === 'settings') return <Settings c={c} network={network} onDone={() => { setScreen('home'); load(); }} />;
  // Phases mirror desktop walletStore.ts derivePhase(): headers, filter headers, then blocks.
  let pct = 0;
  let status = 'Đang kết nối…';
  if (sync?.synced) { pct = 1; status = '● Đã đồng bộ'; }
  else if (sync && sync.best_peer_height <= 0) status = `Đang tìm peer (${sync.connections} kết nối)`;
  else if (sync) {
    const [label, h] = sync.header_height < sync.best_peer_height ? ['Tải header', sync.header_height]
      : sync.filter_header_height < sync.header_height ? ['Tải filter', sync.filter_header_height]
      : ['Quét block', sync.block_height];
    pct = Math.min(1, h / sync.best_peer_height);
    status = `${label} ${h.toLocaleString()} / ${sync.best_peer_height.toLocaleString()} · ${sync.connections} peer`;
  }
  return (
    <FlatList
      contentContainerStyle={s.pad}
      data={txs}
      keyExtractor={(t, i) => t.txid + i}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <View style={s.topRow}>
            <View style={s.row}>
              <Logo />
              <Text style={s.h2}>Pearl</Text>
              {network === 'testnet2' && <Text style={s.badge}>TESTNET</Text>}
            </View>
            <Pressable onPress={() => setScreen('settings')} hitSlop={12}><Text style={s.icon}>⚙︎</Text></Pressable>
          </View>

          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Tổng số dư</Text>
            <Text style={s.balance} adjustsFontSizeToFit numberOfLines={1}>
              {balance === undefined ? '—' : balance.toFixed(8)} <Text style={s.unit}>PRL</Text>
            </Text>
            <View style={s.progress}><View style={[s.progressFill, { width: `${pct * 100}%` }]} /></View>
            <Text style={s.balanceSub}>
              {status}
            </Text>
          </View>

          <View style={s.actions}>
            <Pressable style={s.action} onPress={receive}><Text style={s.actionIcon}>↓</Text><Text style={s.actionText}>Nhận</Text></Pressable>
            <Pressable style={s.action} onPress={() => setScreen('send')}><Text style={s.actionIcon}>↑</Text><Text style={s.actionText}>Gửi</Text></Pressable>
          </View>

          <Text style={s.section}>Hoạt động</Text>
        </View>
      }
      ListEmptyComponent={<View style={s.empty}><Text style={s.muted}>Chưa có giao dịch</Text></View>}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => {
        const inc = item.amount >= 0;
        return (
          <Pressable style={s.tx} onPress={() => txMenu(item)}>
            <View style={[s.txIcon, { backgroundColor: inc ? '#3d4a2a' : '#4a2f2f' }]}>
              <Text style={{ color: inc ? C.green : C.red, fontSize: 18, fontWeight: '700' }}>{inc ? '↓' : '↑'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.txTitle}>{inc ? 'Nhận' : 'Gửi'}</Text>
              <Text style={s.muted}>
                {new Date(item.time * 1000).toLocaleDateString()} · {item.confirmations ? `${item.confirmations} xác nhận` : 'Đang chờ'}
              </Text>
            </View>
            <Text style={[s.txAmt, { color: inc ? C.green : C.fg }]}>{inc ? '+' : ''}{item.amount.toFixed(4)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

function Send({ c, balance, onDone }: { c: Conn; balance?: number; onDone: () => void }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0.0001');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    const feeKb = Number(fee);
    if (!(amt > 0) || !(feeKb > 0)) return Alert.alert('Số tiền / phí không hợp lệ');
    setBusy(true);
    try {
      if (!(await wallet.validate(c, to.trim()))) throw new Error('Địa chỉ không hợp lệ');
      await wallet.unlock(c, pass);
      try {
        const txid = await wallet.send(c, to.trim(), amt, feeKb);
        Alert.alert('Đã gửi', txid);
        onDone();
      } finally {
        await wallet.lock(c).catch(() => {});
      }
    } catch (e) {
      Alert.alert('Gửi thất bại', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert('Xác nhận', `Gửi ${amount} PRL tới\n${to}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Gửi', style: 'destructive', onPress: submit },
    ]);

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Header title="Gửi PRL" onBack={onDone} />
      <View style={s.card}>
        <Field label="Địa chỉ nhận" placeholder="prl1…" value={to} onChangeText={setTo} />
        <Field label={`Số tiền (khả dụng ${balance?.toFixed(8) ?? '—'} PRL)`} placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <Field label="Phí (PRL/kB)" keyboardType="decimal-pad" value={fee} onChangeText={setFee} />
        <Field label="Passphrase" placeholder="••••••••" secureTextEntry value={pass} onChangeText={setPass} />
      </View>
      <Btn title="Tiếp tục" onPress={confirm} busy={busy} disabled={!to || !amount || !pass} />
    </ScrollView>
  );
}

function Settings({ c, network, onDone }: { c: Conn; network: Setup['network']; onDone: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [wif, setWif] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await f();
      Alert.alert(ok);
    } catch (e) {
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Header title="Cài đặt" onBack={onDone} />
      <View style={s.card}>
        <Text style={s.label}>Mạng</Text>
        <Text style={s.txTitle}>{network === 'testnet2' ? 'Testnet' : 'Mainnet'}</Text>
        <Text style={s.muted}>Đổi mạng hoặc ví: xóa app rồi cài lại.</Text>
      </View>
      <Text style={s.section}>Passphrase</Text>
      <View style={s.card}>
        <Field label="Hiện tại" secureTextEntry value={cur} onChangeText={setCur} />
        <Field label="Mới" secureTextEntry value={next} onChangeText={setNext} />
        <Btn title="Đổi passphrase" kind="ghost" busy={busy} disabled={!cur || !next} onPress={() => run(() => wallet.changePass(c, cur, next), 'Đã đổi passphrase')} />
      </View>
      <Text style={s.section}>Nhập private key</Text>
      <View style={s.card}>
        <Field label="WIF" secureTextEntry value={wif} onChangeText={setWif} />
        <Text style={s.muted}>Cần điền passphrase hiện tại ở trên.</Text>
        <Btn title="Nhập key" kind="ghost" busy={busy} disabled={!wif || !cur} onPress={() => run(async () => {
          await wallet.unlock(c, cur);
          try { await wallet.importKey(c, wif.trim()); } finally { await wallet.lock(c).catch(() => {}); }
        }, 'Đã nhập key, đang quét lại')} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', backgroundColor: C.bg },
  center: { alignItems: 'center', gap: 16 },
  pad: { padding: 20, gap: 16, flexGrow: 1 },
  hero: { alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
  title: { color: C.fg, fontSize: 30, fontWeight: '700' },
  h1: { color: C.fg, fontSize: 28, fontWeight: '700' },
  h2: { color: C.fg, fontSize: 20, fontWeight: '700' },
  muted: { color: C.muted, fontSize: 13 },
  label: { color: C.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { color: C.fg, fontSize: 17, fontWeight: '700', marginTop: 4 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#000', fontSize: 20, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 14 },
  in: { backgroundColor: C.bg, color: C.fg, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, fontSize: 16 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimary: { backgroundColor: C.primary },
  btnGhost: { backgroundColor: C.line },
  btnText: { fontSize: 16, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segActive: { backgroundColor: C.primary },
  segText: { color: C.fg, fontWeight: '600' },
  header: { gap: 8, marginBottom: 4 },
  back: { color: C.primary, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { color: C.fg, fontSize: 24 },
  badge: { color: '#000', backgroundColor: C.accent, fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  balanceCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 8, borderWidth: 1, borderColor: C.line },
  balanceLabel: { color: C.muted, fontSize: 13 },
  balance: { color: C.fg, fontSize: 36, fontWeight: '700' },
  unit: { color: C.primary, fontSize: 18, fontWeight: '700' },
  balanceSub: { color: C.muted, fontSize: 12 },
  progress: { height: 4, backgroundColor: C.line, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 4, backgroundColor: C.primary },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, backgroundColor: C.card, borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 4 },
  actionIcon: { color: C.primary, fontSize: 22, fontWeight: '700' },
  actionText: { color: C.fg, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 32 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txTitle: { color: C.fg, fontSize: 15, fontWeight: '600' },
  txAmt: { fontSize: 15, fontWeight: '700' },
});
