import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { initAuthStorage } from '../lib/auth-storage';
import { authApi, setUnauthorizedHandler } from '@hdir/core/src/api-client';

SplashScreen.preventAutoHideAsync();

/**
 * Penjaga rute: tab dan layar dalam hanya boleh dibuka bila ada token.
 * Tanpa token -> /login. Sudah login tapi membuka /login -> /(tabs).
 * 401 dari API juga memicu handler yang sama (token dihapus di core).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initAuthStorage();
      if (cancelled) return;
      setUnauthorizedHandler(() => router.replace('/login'));
      const token = await authApi.getToken();
      if (cancelled) return;
      const inTabs = segments[0] === '(tabs)';
      const inProtected = inTabs || segments[0] === 'history' || segments[0] === 'leave-request';
      const inLogin = segments[0] === 'login';
      if (!token && inProtected) router.replace('/login');
      else if (token && (inLogin || !segments[0])) router.replace('/(tabs)');
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // Jalankan ulang saat segmen berubah agar navigasi manual ke tab tanpa sesi dicegat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.join('/')]);

  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    // Load any custom fonts here if needed
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="leave-request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="history" options={{ presentation: 'card' }} />
      </Stack>
    </AuthGate>
  );
}
