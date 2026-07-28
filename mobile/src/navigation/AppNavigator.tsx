import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOK } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';

import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { HuntScreen } from '../screens/Hunt/HuntScreen';
import { ActiveCallScreen } from '../screens/Hunt/ActiveCallScreen';
import { PostCallScreen } from '../screens/Hunt/PostCallScreen';
import { MapScreen } from '../screens/Map/MapScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { OnboardingScreen } from '../screens/Onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { AddPharmacyScreen } from '../screens/Hunt/AddPharmacyScreen';
import { PharmacyDetailScreen } from '../screens/Hunt/PharmacyDetailScreen';

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Onboarding: undefined;
};

export type HuntStackParamList = {
  HuntMain: undefined;
  ActiveCall: { pharmacyId: number; pharmacyName: string; pharmacyPhone: string };
  PostCall: {
    pharmacyId: number; summary?: string; status?: string; transcript?: string; audioUri?: string;
    medicationName?: string; strength?: string;
  };
  AddPharmacy: undefined;
  PharmacyDetail: { pharmacyId: number };
};

export type TabParamList = {
  Home: undefined;
  Hunt: undefined;
  Map: undefined;
  Me: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const HuntStack = createNativeStackNavigator<HuntStackParamList>();

function TabIcon({ focused, name }: { focused: boolean; name: string }) {
  const color = focused ? TOK.primary : TOK.textDim;
  const icons: Record<string, string> = { Home: '⌂', Hunt: '☎', Map: '⊕', Me: '◉' };
  return (
    <View style={tab.iconWrap}>
      <Text style={[tab.icon, { color }]}>{icons[name] ?? '●'}</Text>
      <Text style={[tab.label, { color }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const tab = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', gap: 2, width: 60 },
  icon: { fontSize: 20, width: 26, lineHeight: 26, textAlign: 'center' },
  label: { fontSize: 10, fontWeight: '600', flexShrink: 0 },
});

function HuntNavigator() {
  return (
    <HuntStack.Navigator screenOptions={{ headerShown: false }}>
      <HuntStack.Screen name="HuntMain" component={HuntScreen} />
      <HuntStack.Screen name="ActiveCall" component={ActiveCallScreen} />
      <HuntStack.Screen name="PostCall" component={PostCallScreen} />
      <HuntStack.Screen name="AddPharmacy" component={AddPharmacyScreen} />
      <HuntStack.Screen name="PharmacyDetail" component={PharmacyDetailScreen} />
    </HuntStack.Navigator>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TOK.surface,
          borderTopColor: TOK.border,
          borderTopWidth: 0.5,
          height: 50 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Home" />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tab.Screen
        name="Hunt"
        component={HuntNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Hunt" />,
          tabBarButtonTestID: "tab-hunt",
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Map" />,
          tabBarButtonTestID: "tab-map",
        }}
      />
      <Tab.Screen
        name="Me"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Me" />,
          tabBarButtonTestID: "tab-me",
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading, hasMedicationProfile } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <RootStack.Screen name="Login" component={LoginScreen} />
        ) : !hasMedicationProfile ? (
          // Gated on the on-device profile store, not app navigation history
          // — so a relaunch mid-onboarding (backgrounded, killed) lands back
          // here instead of silently dropping the user into Main with no
          // profile. Note: a fresh install (or a user who clears app storage)
          // now re-runs onboarding, since there's no server-side record of
          // "already onboarded" to fall back on — an accepted tradeoff of
          // keeping medication profiles off the server.
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <RootStack.Screen name="Main" component={TabNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
