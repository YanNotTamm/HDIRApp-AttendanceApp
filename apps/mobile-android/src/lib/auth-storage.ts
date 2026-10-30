import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { configureTokenStore, type TokenStore } from '@hdir/core/src/api-client';

/**
 * Penyimpanan token mobile.
 *
 * Utama: expo-secure-store (iOS Keychain / Android Keystore-encrypted
 * SharedPreferences). Jalankan `npx expo install expo-secure-store` sebelum
 * build agar versi paket sesuai SDK Expo yang dipakai.
 *
 * Web (Expo web): SecureStore tidak tersedia, jadi dipakai localStorage
 * (sama seperti web-dashboard; catat risiko XSS di laporan).
 *
 * Fallback bila SecureStore tidak tersedia di native: penyimpanan memori
 * sesi saja (token hilang saat aplikasi ditutup). Ini BUKAN AsyncStorage:
 * AsyncStorage tidak terpasang di repo ini, dan AsyncStorage tidak
 * terenkripsi sehingga tidak layak dipakai untuk token tanpa catatan.
 * Jangan pernah menyimpan password di sini — hanya token & profil.
 */
export type StorageKind = 'secure-store' | 'web-localstorage' | 'memory';

let storageKind: StorageKind = 'memory';

const memoryStore = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  } satisfies TokenStore;
})();

async function resolveStore(): Promise<{ store: TokenStore; kind: StorageKind }> {
  if (Platform.OS === 'web') {
    return {
      store: {
        getItem: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        setItem: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
        removeItem: (key: string) => globalThis.localStorage?.removeItem(key),
      },
      kind: 'web-localstorage',
    };
  }
  try {
    if (await SecureStore.isAvailableAsync()) {
      return {
        store: {
          getItem: (key: string) => SecureStore.getItemAsync(key),
          setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
          removeItem: (key: string) => SecureStore.deleteItemAsync(key),
        },
        kind: 'secure-store',
      };
    }
  } catch (err) {
    console.warn('SecureStore tidak tersedia, memakai penyimpanan memori sesi:', err);
  }
  return { store: memoryStore, kind: 'memory' };
}

/** Dipanggil sekali dari root layout sebelum layar apa pun memakai API. */
export async function initAuthStorage(): Promise<StorageKind> {
  const { store, kind } = await resolveStore();
  configureTokenStore(store);
  storageKind = kind;
  return kind;
}

export function getStorageKind(): StorageKind {
  return storageKind;
}
