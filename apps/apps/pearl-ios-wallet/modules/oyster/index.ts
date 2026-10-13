import { requireNativeModule } from 'expo';

type Reply<T> = { result: T; error?: string };
const N = requireNativeModule<{
  dataDir(): string;
  walletExists(dataDir: string, network: string): boolean;
  create(args: string, create: string): Promise<string>;
  start(args: string): string;
  status(): string;
  rpc(auth: string, body: string): Promise<string>;
}>('Oyster');

function unwrap<T>(json: string): T {
  const r: Reply<T> = JSON.parse(json);
  if (r.error) throw new Error(r.error);
  return r.result;
}

export const dataDir = () => N.dataDir();
export const walletExists = (network: string) => N.walletExists(N.dataDir(), network);
// Returns the 12-word mnemonic (new or imported).
export const create = async (args: string[], c: { PrivatePassphrase: string; Seed?: string; Bday?: string }) =>
  unwrap<string>(await N.create(JSON.stringify(args), JSON.stringify(c)));
export const start = (args: string[]) => unwrap<boolean>(N.start(JSON.stringify(args)));
export const status = () => unwrap<boolean>(N.status());
// One JSON-RPC call straight into oyster's handler; returns HTTP status and body text.
export const rpc = async (auth: string, body: string) =>
  unwrap<{ status: number; body: string }>(await N.rpc(auth, body));
