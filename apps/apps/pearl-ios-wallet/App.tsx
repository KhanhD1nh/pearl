import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Button, FlatList, RefreshControl, SafeAreaView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Oyster from './modules/oyster';
import { Conn, Sync, Tx, wallet } from './rpc';

// Embedded oyster, same flags as desktop wallet-process.ts getWalletArgs().
type Setup = { network: 'mainnet' | 'testnet2'; user: string; pass: string };
const KEY = 'pearl-setup';
const PORT = 8335;
const conn = (s: Setup): Conn => ({ url: `http://127.0.0.1:${PORT}`, user: s.user, pass: s.pass });
const args = (s: Setup) => [
  '--usespv', `--appdata=${Oyster.dataDir()}`, `--username=${s.user}`, `--password=${s.pass}`,
  `--rpclisten=127.0.0.1:${PORT}`, '--noservertls', ...(s.network === 'testnet2' ? ['--testnet2'] : []),
];
// ponytail: Math.random creds; RPC only listens on 127.0.0.1 inside the app. Use expo-crypto if exposed further.
const rnd = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export default function App() {
  const [setup, setSetup] = useState<Setup | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then(v => setSetup(v ? JSON.parse(v) : null));
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
  if (setup === undefined) body = <ActivityIndicator />;
  else if (!setup) body = <Onboard onDone={async s => { await SecureStore.setItemAsync(KEY, JSON.stringify(s)); setSetup(s); }} />;
  else if (!ready) body = <View style={s.pad}><ActivityIndicator /><Text style={s.muted}>Đang khởi động ví…</Text></View>;
  else body = <Wallet c={conn(setup)} network={setup.network} />;
  return (
    <SafeAreaView style={s.fill}>
      {body}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function Onboard({ onDone }: { onDone: (s: Setup) => Promise<void> }) {
  const [network, setNetwork] = useState<Setup['network']>('mainnet');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [seed, setSeed] = useState('');
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);

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
    <View style={s.pad}>
      <Text style={s.h1}>Pearl Wallet</Text>
      <View style={s.row}>
        <Button title={(network === 'mainnet' ? '● ' : '') + 'Mainnet'} onPress={() => setNetwork('mainnet')} />
        <Button title={(network === 'testnet2' ? '● ' : '') + 'Testnet'} onPress={() => setNetwork('testnet2')} />
      </View>
      <View style={s.row}>
        <Button title={(!importing ? '● ' : '') + 'Tạo ví mới'} onPress={() => setImporting(false)} />
        <Button title={(importing ? '● ' : '') + 'Khôi phục từ seed'} onPress={() => setImporting(true)} />
      </View>
      {importing && (
        <TextInput style={[s.in, { minHeight: 80 }]} multiline placeholder="12 từ seed" autoCapitalize="none" autoCorrect={false} value={seed} onChangeText={setSeed} />
      )}
      <TextInput style={s.in} placeholder="Passphrase ví" secureTextEntry value={pass} onChangeText={setPass} />
      <TextInput style={s.in} placeholder="Nhập lại passphrase" secureTextEntry value={pass2} onChangeText={setPass2} />
      {busy ? <ActivityIndicator /> : <Button title="Tiếp tục" onPress={submit} />}
    </View>
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

  if (screen === 'send') return <Send c={c} onDone={() => { setScreen('home'); load(); }} />;
  if (screen === 'settings') return <Settings c={c} network={network} onDone={() => { setScreen('home'); load(); }} />;
  return (
    <FlatList
      contentContainerStyle={s.pad}
      data={txs}
      keyExtractor={(t, i) => t.txid + i}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={
        <View>
          <Text style={s.muted}>
            {network === 'testnet2' ? 'Testnet · ' : ''}
            {sync ? (sync.synced ? 'Đã đồng bộ' : `Đồng bộ ${sync.block_height}/${sync.best_peer_height}`) : '…'}
          </Text>
          <Text style={s.h1}>{balance === undefined ? '…' : `${balance.toFixed(8)} PRL`}</Text>
          <View style={s.row}>
            <Button title="Nhận" onPress={receive} />
            <Button title="Gửi" onPress={() => setScreen('send')} />
            <Button title="Cài đặt" onPress={() => setScreen('settings')} />
          </View>
          <Text style={s.h2}>Giao dịch</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.muted}>Chưa có giao dịch</Text>}
      renderItem={({ item }) => (
        <View style={s.tx} onTouchEnd={() => txMenu(item)}>
          <Text style={{ color: item.amount < 0 ? '#c00' : '#080' }}>
            {item.amount > 0 ? '+' : ''}{item.amount.toFixed(8)} PRL
          </Text>
          <Text style={s.muted}>
            {new Date(item.time * 1000).toLocaleString()} · {item.confirmations} xác nhận
          </Text>
          <Text style={s.muted} numberOfLines={1} ellipsizeMode="middle">{item.txid}</Text>
        </View>
      )}
    />
  );
}

function Send({ c, onDone }: { c: Conn; onDone: () => void }) {
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
    <View style={s.pad}>
      <Text style={s.h1}>Gửi PRL</Text>
      <TextInput style={s.in} placeholder="Địa chỉ prl1…" autoCapitalize="none" autoCorrect={false} value={to} onChangeText={setTo} />
      <TextInput style={s.in} placeholder="Số tiền (PRL)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={s.in} placeholder="Phí (PRL/kB)" keyboardType="decimal-pad" value={fee} onChangeText={setFee} />
      <TextInput style={s.in} placeholder="Passphrase ví" secureTextEntry value={pass} onChangeText={setPass} />
      {busy ? <ActivityIndicator /> : (
        <View style={s.row}>
          <Button title="Hủy" onPress={onDone} />
          <Button title="Gửi" onPress={confirm} />
        </View>
      )}
    </View>
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
    <View style={s.pad}>
      <Text style={s.h1}>Cài đặt</Text>
      <Text style={s.muted}>Mạng: {network}. Đổi mạng/ví: xóa app rồi cài lại.</Text>
      <Text style={s.h2}>Đổi passphrase</Text>
      <TextInput style={s.in} placeholder="Passphrase hiện tại" secureTextEntry value={cur} onChangeText={setCur} />
      <TextInput style={s.in} placeholder="Passphrase mới" secureTextEntry value={next} onChangeText={setNext} />
      <Button title="Đổi" disabled={busy || !cur || !next} onPress={() => run(() => wallet.changePass(c, cur, next), 'Đã đổi passphrase')} />
      <Text style={s.h2}>Nhập private key (WIF)</Text>
      <TextInput style={s.in} placeholder="WIF" autoCapitalize="none" autoCorrect={false} secureTextEntry value={wif} onChangeText={setWif} />
      <Button title="Nhập (cần passphrase hiện tại)" disabled={busy || !wif || !cur} onPress={() => run(async () => {
        await wallet.unlock(c, cur);
        try { await wallet.importKey(c, wif.trim()); } finally { await wallet.lock(c).catch(() => {}); }
      }, 'Đã nhập key, đang quét lại')} />
      {busy && <ActivityIndicator />}
      <Button title="Quay lại" onPress={onDone} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', backgroundColor: '#fff' },
  pad: { padding: 20, gap: 12 },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  muted: { color: '#666', fontSize: 13 },
  in: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
  tx: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
});
