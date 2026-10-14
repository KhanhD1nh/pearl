import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import * as Passphrase from '@/lib/passphrase';

// User settings, kept in the Keychain (no auth) next to the wallet setup.
export type Theme = 'dark' | 'system';
export type Prefs = {
  theme: Theme;
  faceIdLogin: boolean; // Face ID gate on launch and when returning from background
  faceIdSend: boolean; // send with the Face ID-protected passphrase (lib/passphrase.ts)
};
const KEY = 'pearl-prefs';
const DEFAULTS: Prefs = { theme: 'dark', faceIdLogin: false, faceIdSend: false };

const applyTheme = (t: Theme) => Appearance.setColorScheme(t === 'dark' ? 'dark' : 'unspecified');
applyTheme(DEFAULTS.theme);

type Ctx = { prefs?: Prefs; set: (p: Partial<Prefs>) => Promise<void> };
const PrefsCtx = createContext<Ctx>({ set: async () => {} });
export const usePrefs = () => useContext(PrefsCtx);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>();
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then(async v => {
      const p: Prefs = { ...DEFAULTS, ...(v ? JSON.parse(v) : {}) };
      // Send-with-Face ID needs the saved passphrase; iOS drops it when biometrics change.
      p.faceIdSend &&= await Passphrase.hasSaved();
      applyTheme(p.theme);
      setPrefs(p);
    });
  }, []);
  const set = async (patch: Partial<Prefs>) => {
    const p = { ...(prefs ?? DEFAULTS), ...patch };
    if (patch.theme) applyTheme(patch.theme);
    setPrefs(p);
    await SecureStore.setItemAsync(KEY, JSON.stringify(p));
  };
  return <PrefsCtx.Provider value={{ prefs, set }}>{children}</PrefsCtx.Provider>;
}

export async function biometricReady() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function authenticate(reason: string) {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Hủy' });
  return r.success;
}
