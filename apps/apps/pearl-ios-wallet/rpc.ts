// JSON-RPC client for an oyster wallet (wallet/rpcserver.go). Keys stay on the server.
export type Conn = { url: string; user: string; pass: string };

export async function rpc<T>(c: Conn, method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${c.user}:${c.pass}`) },
    body: JSON.stringify({ jsonrpc: '1.0', id: Date.now(), method, params }),
  });
  if (res.status === 401) throw new Error('Sai username/password RPC');
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));
  return body.result as T;
}

export type Tx = { txid: string; category: string; amount: number; confirmations: number; time: number; address?: string };

// Same calls/params as pearl-desktop-wallet wallet-rpc-methods.ts
export const wallet = {
  balance: (c: Conn) => rpc<number>(c, 'getbalance', ['*', 0]),
  addresses: (c: Conn) => rpc<string[]>(c, 'getaddressesbyaccount', ['default']),
  newAddress: (c: Conn) => rpc<string>(c, 'getnewaddress', ['default']),
  txs: (c: Conn) => rpc<Tx[]>(c, 'listtransactions', [null, 50, 0]),
  validate: (c: Conn, a: string) => rpc<{ isvalid: boolean }>(c, 'validateaddress', [a]).then(r => r.isvalid),
  unlock: (c: Conn, pass: string) => rpc<void>(c, 'walletpassphrase', [pass, 60]),
  lock: (c: Conn) => rpc<void>(c, 'walletlock'),
  // Amounts in PRL, fee in PRL/kB (node/btcjson SendManyCmd). minconf 0 like desktop.
  send: (c: Conn, to: string, amount: number, feePerKb: number) =>
    rpc<string>(c, 'sendmany', ['default', { [to]: amount }, feePerKb, 0]),
};
