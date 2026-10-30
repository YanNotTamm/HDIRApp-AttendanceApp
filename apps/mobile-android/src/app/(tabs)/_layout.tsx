import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Home, Camera, User } from 'lucide-react-native';
import { authApi } from '@hdir/core/src/api-client';

export default function TabLayout() {
  // Pertahanan kedua selain AuthGate di root layout: tab tidak boleh
  // dirender tanpa token, walau dibuka langsung lewat deep link.
  useEffect(() => {
    authApi.getToken().then((token) => {
      if (!token) router.replace('/login');
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Absen',
          tabBarIcon: ({ color, size }) => (
            <Camera size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
