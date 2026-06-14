import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TOK } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';

import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { HuntScreen } from '../screens/Hunt/HuntScreen';
import { PreFlightScreen } from '../screens/Hunt/PreFlightScreen';
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
  PreFlight: { pharmacyId: number; pharmacyPhone: string };
  ActiveCall: { pharmacyId: number; pharmacyName: string; pharmacyPhone: string };
  PostCall: { pharmacyId: number; summary?: string; status?: string; transcript?: string; audioUri?: string };
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
      <Text style={[tab.label, { color }]}>{name}</Text>
    </View>
  );
}

const tab = StyleSheet.create({
  iconWrap: { alignItems: 'center', gap: 2 },
  icon: { fontSize: 20 },
  label: { fontSize: 10, fontWeight: '600' },
});

function HuntNavigator() {
  return (
    <HuntStack.Navigator screenOptions={{ headerShown: false }}>
      <HuntStack.Screen name="HuntMain" component={HuntScreen} />
      <HuntStack.Screen name="PreFlight" component={PreFlightScreen} />
      <HuntStack.Screen name="ActiveCall" component={ActiveCallScreen} />
      <HuntStack.Screen name="PostCall" component={PostCallScreen} />
      <HuntStack.Screen name="AddPharmacy" component={AddPharmacyScreen} />
      <HuntStack.Screen name="PharmacyDetail" component={PharmacyDetailScreen} />
    </HuntStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TOK.surface,
          borderTopColor: TOK.border,
          borderTopWidth: 0.5,
          height: 80,
          paddingBottom: 16,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Home" /> }}
      />
      <Tab.Screen
        name="Hunt"
        component={HuntNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Hunt" /> }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Map" /> }}
      />
      <Tab.Screen
        name="Me"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="Me" /> }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : (
          <RootStack.Screen name="Main" component={TabNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
