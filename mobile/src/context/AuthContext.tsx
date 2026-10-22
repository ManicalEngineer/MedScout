import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getToken, clearToken, setUnauthorizedHandler } from '../api/client';
import { getMe, refreshSession, User } from '../api/auth';
import { listProfiles, setActiveUserId } from '../storage/medicationProfiles';
import {
  setActiveUserId as setFlagsActiveUserId,
  hasSeenWalkthrough, markWalkthroughSeen,
  isFirstSessionEver, markFirstSessionDone,
} from '../storage/deviceFlags';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // Medication profiles live on-device only (see storage/medicationProfiles.ts)
  // — this drives the Onboarding vs Main routing decision in AppNavigator,
  // where a server-side flag used to.
  hasMedicationProfile: boolean;
  // Feature walkthrough (see screens/Walkthrough) — shown once, after
  // onboarding, before Main. Separate flag from hasMedicationProfile so an
  // existing install picking up this update sees it too, exactly once.
  hasSeenWalkthrough: boolean;
  dismissWalkthrough: () => Promise<void>;
  // True for the entire lifetime of this app process if this is the
  // account's first-ever session (computed once on the first refresh() that
  // resolves a user, cached for the process so later refresh() calls in the
  // same session — e.g. right after onboarding — don't flip it). Used to
  // keep the store-review prompt off on first launch.
  isFirstLaunchSession: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasMedicationProfile: false,
  hasSeenWalkthrough: false,
  dismissWalkthrough: async () => {},
  isFirstLaunchSession: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasMedicationProfile, setHasMedicationProfile] = useState(false);
  const [walkthroughSeen, setWalkthroughSeen] = useState(false);
  const [isFirstLaunchSession, setIsFirstLaunchSession] = useState(true);
  const [loading, setLoading] = useState(true);
  // Only resolved once per process — see isFirstLaunchSession's doc comment.
  const firstLaunchResolvedRef = useRef(false);

  const refresh = async () => {
    try {
      const token = await getToken();
      if (!token) { await setActiveUserId(null); setFlagsActiveUserId(null); setUser(null); return; }
      const me = await getMe();
      // Must resolve before listProfiles()/hasSeenWalkthrough() below, so
      // storage reads from this account's namespaced key, not whatever was
      // active before.
      await setActiveUserId(me.id);
      setFlagsActiveUserId(me.id);
      setUser(me);
      setHasMedicationProfile((await listProfiles()).length > 0);
      setWalkthroughSeen(await hasSeenWalkthrough());
      if (!firstLaunchResolvedRef.current) {
        firstLaunchResolvedRef.current = true;
        const firstEver = await isFirstSessionEver();
        setIsFirstLaunchSession(firstEver);
        if (firstEver) await markFirstSessionDone();
      }
      refreshSession(); // fire-and-forget: slides the 7-day session forward
    } catch {
      await setActiveUserId(null);
      setFlagsActiveUserId(null);
      setUser(null);
    }
  };

  const dismissWalkthrough = async () => {
    await markWalkthroughSeen();
    setWalkthroughSeen(true);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await clearToken();
    await setActiveUserId(null);
    setFlagsActiveUserId(null);
    setUser(null);
  };

  // client.ts already clears the token when any request comes back 401 — this
  // just drops the in-memory user so AppNavigator swaps to the auth stack.
  useEffect(() => {
    setUnauthorizedHandler(() => { setActiveUserId(null); setFlagsActiveUserId(null); setUser(null); });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, hasMedicationProfile,
      hasSeenWalkthrough: walkthroughSeen, dismissWalkthrough,
      isFirstLaunchSession,
      signOut, refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
