import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { authApi, roleName, type SessionUser } from '@hdir/core/src/api-client';
import { getStorageKind } from '../../lib/auth-storage';

export default function ProfileScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        // /auth/me kini nyata (backend baru) dan lebih lengkap daripada
        // profil respons login (tanpa nama); pakai sesi hanya sebagai fallback.
        const stored = await authApi.getStoredUser();
        const profile = (await authApi.getMe().catch(() => null)) ?? stored;
        if (!cancelled) {
          setUser(profile);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleLogout = async () => {
    await authApi.logout();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.text}>Data profil belum tersedia.</Text>
        <Text style={styles.subtext}>
          Sesi tidak menyimpan profil dan server tidak mengembalikan profil. Silakan keluar lalu masuk kembali.
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user.name ?? '-'}</Text>
        <Text style={styles.subtext}>{user.email ?? '-'}</Text>
        <Text style={styles.row}>Peran: {roleName(user) || '-'}</Text>
        {user.employee_code ? <Text style={styles.row}>Kode karyawan: {user.employee_code}</Text> : null}
        {user.id !== undefined ? <Text style={styles.row}>ID: {user.id}</Text> : null}
        <Text style={styles.hint}>
          Token disimpan di: {getStorageKind() === 'secure-store' ? 'SecureStore (terenkripsi OS)' : getStorageKind() === 'web-localstorage' ? 'localStorage (web)' : 'memori sesi saja (tidak persisten)'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() =>
          Alert.alert('Keluar', 'Keluar dari akun ini?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Keluar', style: 'destructive', onPress: handleLogout },
          ])
        }
      >
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
  text: {
    fontSize: 18,
    color: '#0f172a',
    textAlign: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtext: {
    fontSize: 14,
    color: '#64748b',
  },
  row: {
    fontSize: 15,
    color: '#334155',
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 12,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
