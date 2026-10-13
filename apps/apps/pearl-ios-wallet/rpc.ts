import * as Oyster from '@/modules/oyster';

// JSON-RPC to the embedded oyster wallet (wallet/rpcserver.go), called in-process via
// OysterRPC rather than fetch: iOS drops the app's loopback socket after a while in background.
export type Conn = { url: string; user: string; pass: string };

export async function rpc<T>(c: Conn, method: string, params: unknown[] = []): Promise<T> {
  const res = await Oyster.rpc(
    'Basic ' + btoa(`${c.user}:${c.pass}`),
    JSON.stringify({ jsonrpc: '1.0', id: Date.now(), method, params }),
  );
  if (res.status === 401) throw new Error('RPC auth failed');
  const body = JSON.parse(res.body);
  if (body.error) throw new RpcError(body.error.code, body.error.message ?? JSON.stringify(body.error));
  return body.result as T;
}

// Keeps the JSON-RPC error code (e.g. -9 = no peers, nothing signed) like desktop rpc-client.ts.
export class RpcError extends Error {
  constructor(readonly code: number | undefined, message: string) {
    super(message);
  }
}

export type Tx = { txid: string; category: string; amount: number; fee?: number; confirmations: number; time: number; address?: string };
export type Sync = { header_height: number; filter_header_height: number; block_height: number; best_peer_height: number; connections: number; synced: boolean };

// Same calls/params as pearl-desktop-wallet wallet-rpc-methods.ts
export const wallet = {
  balance: (c: Conn) => rpc<number>(c, 'getbalance', ['*', 0]),
  sync: (c: Conn) => rpc<Sync>(c, 'getsyncprogress'),
  addresses: (c: Conn) => rpc<string[]>(c, 'getaddressesbyaccount', ['default']),
  newAddress: (c: Conn) => rpc<string>(c, 'getnewaddress', ['default']),
  txs: (c: Conn) => rpc<Tx[]>(c, 'listalltransactions'),
  validate: (c: Conn, a: string) => rpc<{ isvalid: boolean }>(c, 'validateaddress', [a]).then(r => r.isvalid),
  unlock: (c: Conn, pass: string) => rpc<void>(c, 'walletpassphrase', [pass, 60]),
  lock: (c: Conn) => rpc<void>(c, 'walletlock'),
  changePass: (c: Conn, cur: string, next: string) => rpc<void>(c, 'walletpassphrasechange', [cur, next]),
  importKey: (c: Conn, wif: string) => rpc<void>(c, 'importprivkey', [wif, 'imported', true]),
  rebroadcast: (c: Conn, txid: string) => rpc<unknown>(c, 'rebroadcasttransaction', [txid]),
  remove: (c: Conn, txid: string) => rpc<unknown>(c, 'removetransaction', [txid]),
  // Amounts in PRL, fee in PRL/kB (node/btcjson SendManyCmd). minconf 0 like desktop.
  send: (c: Conn, to: string, amount: number, feePerKb: number) =>
    rpc<string>(c, 'sendmany', ['default', { [to]: amount }, feePerKb, 0]),
};
