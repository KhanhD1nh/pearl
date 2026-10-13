import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Oyster from '@/modules/oyster';
import { Conn, Sync, Tx, wallet } from '@/rpc';

// Embedded oyster, same flags as desktop wallet-process.ts getWalletArgs().
export type Network = 'mainnet' | 'testnet2';
export type Setup = { network: Network; user: string; pass: string };
const KEY = 'pearl-setup';
const PORT = 8335;

export const oysterArgs = (s: Setup) => [
  '--usespv', `--appdata=${Oyster.dataDir()}`, `--logdir=${Oyster.dataDir()}/logs`, `--username=${s.user}`, `--password=${s.pass}`,
  `--rpclisten=127.0.0.1:${PORT}`, '--noservertls', ...(s.network === 'testnet2' ? ['--testnet2'] : []),
];
// ponytail: Math.random creds; RPC only listens on 127.0.0.1 inside the app. Use expo-crypto if exposed further.
export const randomCred = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

type State = {
  setup: Setup | null | undefined; // undefined = reading keychain
  ready: boolean; // oyster RPC answering
  saveSetup: (s: Setup) => Promise<void>;
  c: Conn;
  balance?: number;
  sync?: Sync;
  txs?: Tx[]; // undefined until first load
  loading: boolean;
  load: () => Promise<void>;
  error?: string; // last refresh failure, cleared on success
};

const Ctx = createContext<State | null>(null);
export const useWallet = () => useContext(Ctx)!;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<Setup | null>();
  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState<number>();
  const [sync, setSync] = useState<Sync>();
  const [txs, setTxs] = useState<Tx[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const c: Conn = { url: `http://127.0.0.1:${PORT}`, user: setup?.user ?? '', pass: setup?.pass ?? '' };

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
      Oyster.start(oysterArgs(setup));
    } catch (e) {
      return Alert.alert('Không khởi động được ví', String((e as Error).message));
    }
    const t = setInterval(async () => {
      try {
        Oyster.status(); // throws once oyster has exited
      } catch (e) {
        clearInterval(t);
        return Alert.alert('Ví dừng', String((e as Error).message));
      }
      // RPC server not listening yet: retry. Expo fetch wording varies, so don't match it.
      await wallet.balance(c).then(() => { setReady(true); clearInterval(t); }, () => {});
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  // Errors go to `error` (shown inline), not Alert: polling every 10s would spam
  // alerts while iOS suspends the app or oyster is busy.
  // `loading` drives the pull-to-refresh spinner, so only user refreshes set it;
  // background polls stay silent or the list jumps every 10s.
  const fetchAll = useCallback(async () => {
    try {
      const [b, t, y] = await Promise.all([wallet.balance(c), wallet.txs(c), wallet.sync(c)]);
      setBalance(b);
      setSync(y);
      setTxs([...t].sort((a, z) => z.time - a.time));
      setError(undefined);
    } catch (e) {
      setError(String((e as Error).message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => {
    if (!ready) return;
    let t: number | undefined;
    // Poll only while foreground; iOS suspends the app (and oyster) in background.
    const start = () => { fetchAll(); t ??= setInterval(fetchAll, 10000); };
    const stop = () => { clearInterval(t); t = undefined; };
    start();
    const sub = AppState.addEventListener('change', s => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [ready, fetchAll]);

  const saveSetup = async (s: Setup) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
    setSetup(s);
  };

  return <Ctx.Provider value={{ setup, ready, saveSetup, c, balance, sync, txs, loading, load, error }}>{children}</Ctx.Provider>;
}

// Phases mirror desktop walletStore.ts derivePhase(): headers, filter headers, then blocks.
export function syncStatus(sync?: Sync): { pct: number; label: string; synced: boolean } {
  if (!sync) return { pct: 0, label: 'Đang kết nối…', synced: false };
  if (sync.synced) return { pct: 1, label: 'Đã đồng bộ', synced: true };
  if (sync.best_peer_height <= 0) return { pct: 0, label: `Đang tìm peer · ${sync.connections} kết nối`, synced: false };
  const [label, h] = sync.header_height < sync.best_peer_height ? ['Tải header', sync.header_height]
    : sync.filter_header_height < sync.header_height ? ['Tải filter', sync.filter_header_height]
    : ['Quét block', sync.block_height];
  return {
    pct: Math.min(1, h / sync.best_peer_height),
    label: `${label} ${h.toLocaleString()} / ${sync.best_peer_height.toLocaleString()}`,
    synced: false,
  };
}
