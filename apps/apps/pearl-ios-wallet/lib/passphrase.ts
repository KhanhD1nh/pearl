import * as SecureStore from 'expo-secure-store';

// Wallet passphrase kept in the Keychain behind Face ID / Touch ID, so sends only need a face scan.
// Bound to this device's biometrics: adding a new face/finger invalidates it and we fall back to typing.
const KEY = 'pearl-pass';
const FLAG = 'pearl-pass-saved'; // readable without a prompt, tells the UI whether to show the field
const OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Xác thực để gửi PRL',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export const biometricAvailable = () => SecureStore.canUseBiometricAuthentication();
export const hasSaved = async () => (await SecureStore.getItemAsync(FLAG)) === '1';

export async function save(pass: string) {
  if (!biometricAvailable()) return;
  await SecureStore.setItemAsync(KEY, pass, OPTS);
  await SecureStore.setItemAsync(FLAG, '1');
}

// Prompts Face ID. Null when the user cancels or the item was invalidated.
export async function read(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY, OPTS);
  } catch {
    return null;
  }
}

export async function forget() {
  await SecureStore.deleteItemAsync(KEY, OPTS);
  await SecureStore.deleteItemAsync(FLAG);
}
