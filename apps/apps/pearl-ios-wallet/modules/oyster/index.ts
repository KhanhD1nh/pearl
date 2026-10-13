import { requireNativeModule } from 'expo';

type Reply<T> = { result: T; error?: string };
const N = requireNativeModule<{
  dataDir(): string;
  create(args: string, create: string): Promise<string>;
  start(args: string): string;
  status(): string;
}>('Oyster');

function unwrap<T>(json: string): T {
  const r: Reply<T> = JSON.parse(json);
  if (r.error) throw new Error(r.error);
  return r.result;
}

export const dataDir = () => N.dataDir();
// Returns the 12-word mnemonic (new or imported).
export const create = async (args: string[], c: { PrivatePassphrase: string; Seed?: string; Bday?: string }) =>
  unwrap<string>(await N.create(JSON.stringify(args), JSON.stringify(c)));
export const start = (args: string[]) => unwrap<boolean>(N.start(JSON.stringify(args)));
export const status = () => unwrap<boolean>(N.status());
