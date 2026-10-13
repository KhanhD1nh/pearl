import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Button, FlatList, RefreshControl, SafeAreaView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Conn, Tx, wallet } from './rpc';

const KEY = 'pearl-conn';

export default function App() {
  const [conn, setConn] = useState<Conn | null | undefined>(undefined);
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then(v => setConn(v ? JSON.parse(v) : null));
  }, []);
  const save = async (c: Conn | null) => {
    if (c) await SecureStore.setItemAsync(KEY, JSON.stringify(c));
    else await SecureStore.deleteItemAsync(KEY);
    setConn(c);
  };
  if (conn === undefined) return <ActivityIndicator style={s.fill} />;
  return (
    <SafeAreaView style={s.fill}>
      {conn ? <Wallet conn={conn} onLogout={() => save(null)} /> : <Connect onSave={save} />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function Connect({ onSave }: { onSave: (c: Conn) => Promise<void> }) {
  const [c, setC] = useState<Conn>({ url: 'https://', user: '', pass: '' });
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    try {
      await wallet.balance(c);
      await onSave(c);
    } catch (e) {
      Alert.alert('Kết nối thất bại', String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.pad}>
      <Text style={s.h1}>Pearl Wallet</Text>
      <Text style={s.muted}>Kết nối tới oyster wallet RPC (khóa nằm trên server).</Text>
      <TextInput style={s.in} placeholder="RPC URL" autoCapitalize="none" keyboardType="url" value={c.url} onChangeText={url => setC({ ...c, url })} />
      <TextInput style={s.in} placeholder="Username" autoCapitalize="none" value={c.user} onChangeText={user => setC({ ...c, user })} />
      <TextInput style={s.in} placeholder="Password" secureTextEntry value={c.pass} onChangeText={pass => setC({ ...c, pass })} />
      {busy ? <ActivityIndicator /> : <Button title="Kết nối" onPress={test} />}
    </View>
  );
}

function Wallet({ conn, onLogout }: { conn: Conn; onLogout: () => void }) {
  const [balance, setBalance] = useState<number>();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, t] = await Promise.all([wallet.balance(conn), wallet.txs(conn)]);
      setBalance(b);
      setTxs([...t].reverse());
    } catch (e) {
      Alert.alert('Lỗi', String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [conn]);
  useEffect(() => { load(); }, [load]);

  const receive = async () => {
    try {
      const addr = (await wallet.addresses(conn))[0] ?? (await wallet.newAddress(conn));
      // ponytail: share sheet instead of QR; add react-native-qrcode-svg if users need scanning.
      await Share.share({ message: addr });
    } catch (e) {
      Alert.alert('Lỗi', String((e as Error).message));
    }
  };

  if (sending) return <Send conn={conn} onDone={() => { setSending(false); load(); }} />;
  return (
    <FlatList
      contentContainerStyle={s.pad}
      data={txs}
      keyExtractor={(t, i) => t.txid + i}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={
        <View>
          <Text style={s.muted}>Số dư</Text>
          <Text style={s.h1}>{balance === undefined ? '…' : `${balance.toFixed(8)} PRL`}</Text>
          <View style={s.row}>
            <Button title="Nhận" onPress={receive} />
            <Button title="Gửi" onPress={() => setSending(true)} />
            <Button title="Ngắt kết nối" color="#c00" onPress={onLogout} />
          </View>
          <Text style={s.h2}>Giao dịch</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.muted}>Chưa có giao dịch</Text>}
      renderItem={({ item }) => (
        <View style={s.tx}>
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

function Send({ conn, onDone }: { conn: Conn; onDone: () => void }) {
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
      if (!(await wallet.validate(conn, to.trim()))) throw new Error('Địa chỉ không hợp lệ');
      await wallet.unlock(conn, pass);
      try {
        const txid = await wallet.send(conn, to.trim(), amt, feeKb);
        Alert.alert('Đã gửi', txid);
        onDone();
      } finally {
        await wallet.lock(conn).catch(() => {});
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
