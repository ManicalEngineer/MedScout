import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, clearToken, setUnauthorizedHandler } from '../api/client';
import { getMe, refreshSession, User } from '../api/auth';
import { listProfiles } from '../storage/medicationProfiles';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // Medication profiles live on-device only (see storage/medicationProfiles.ts)
  // — this drives the Onboarding vs Main routing decision in AppNavigator,
  // where a server-side flag used to.
  hasMedicationProfile: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasMedicationProfile: false,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasMedicationProfile, setHasMedicationProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const token = await getToken();
      if (!token) { setUser(null); return; }
      const me = await getMe();
      setUser(me);
      setHasMedicationProfile((await listProfiles()).length > 0);
      refreshSession(); // fire-and-forget: slides the 7-day session forward
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await clearToken();
    setUser(null);
  };

  // client.ts already clears the token when any request comes back 401 — this
  // just drops the in-memory user so AppNavigator swaps to the auth stack.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, hasMedicationProfile, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
